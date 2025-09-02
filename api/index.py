import datetime
import logging
import os
import re
import uuid
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request as FastAPIRequest, HTTPException
from fastapi.responses import StreamingResponse
from upstash_redis.asyncio import Redis as AsyncRedis
from upstash_redis import Redis as SyncRedis
from upstash_ratelimit import Ratelimit, SlidingWindow
from utils.logger import logger
from starlette.concurrency import run_in_threadpool

# Load environment variables from .env file
load_dotenv()

# Blocking httpx logs for chunks that crowd out everything else
logging.getLogger("httpx").setLevel(logging.WARNING)


# Initialize Redis and Rate Limiter from environment variables
# redis = AsyncRedis.from_url(os.getenv("UPSTASH_REDIS_REST_URL"))
redis = AsyncRedis.from_env()
# sync redis for rate limiter, required by upstash_ratelimit
ratelimit = Ratelimit(
    redis=SyncRedis.from_env(),
    limiter=SlidingWindow(max_requests=3, window=10),
)
backend_url = os.getenv("API_URL")
backend_api_key = os.getenv("API_KEY")


def sanitize_content(content: str) -> str:
    """
    Sanitize user input to prevent injection attacks.
    Returns the cleaned content or raises ValueError if malicious.
    """
    if not content:
        return content
    
    # Convert to lowercase for case-insensitive matching
    content_lower = content.lower()
    
    # Check for various injection patterns
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',  # Script tags
        r'<iframe[^>]*>.*?</iframe>',  # Iframe tags
        r'javascript:',                 # JavaScript protocol
        r'data:text/html',             # Data URLs with HTML
        r'vbscript:',                  # VBScript protocol
        r'on\w+\s*=',                  # Event handlers (onclick, onload, etc.)
        r'<object[^>]*>.*?</object>',  # Object tags
        r'<embed[^>]*>',               # Embed tags
        r'<form[^>]*>.*?</form>',      # Form tags
        r'<input[^>]*>',               # Input tags
        r'<textarea[^>]*>.*?</textarea>',  # Textarea tags
        r'<select[^>]*>.*?</select>',  # Select tags
        r'<button[^>]*>.*?</button>',  # Button tags
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, content, re.IGNORECASE | re.DOTALL):
            raise ValueError(f"Potentially malicious content detected: {pattern}")
    
    # # Check for suspicious URLs
    # url_patterns = [
    #     r'https?://[^\s<>"]*',  # HTTP/HTTPS URLs
    # ]
    
    # for pattern in url_patterns:
    #     matches = re.findall(pattern, content, re.IGNORECASE)
    #     for url in matches:
    #         # Allow common safe domains (customize as needed)
    #         safe_domains = [
    #             'github.com', 'stackoverflow.com', 'wikipedia.org',
    #             'docs.python.org', 'python.org', 'pypi.org'
    #         ]
    #         is_safe = any(domain in url.lower() for domain in safe_domains)
    #         if not is_safe:
    #             raise ValueError(f"Potentially unsafe URL detected: {url}")
    
    # Basic length check
    if len(content) > 10000:  # 10KB limit
        raise ValueError("Content too long")
    
    return content


app = FastAPI()

async def trigger_stream_generation(thread_id: str, stream_id: str, chat_request: dict) -> None:
    """Triggers the backend to start generating the stream."""
    if not backend_url or not backend_api_key:
        raise HTTPException(status_code=500, detail="Backend service not configured.")
    
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": backend_api_key
    }
    
    # The backend needs both the thread_id for history and a unique stream_id for the Redis key.
    backend_request = {**chat_request, "thread_id": thread_id, "stream_id": stream_id}
    
    logger.info("Triggering stream generation on backend", extra={"thread_id": thread_id, "stream_id": stream_id, "request": chat_request})

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(backend_url, json=backend_request, headers=headers, timeout=10)
            response.raise_for_status()
    except httpx.RequestError as e:
        logger.exception("Could not trigger stream generation on backend", extra={"error": str(e)})
        raise HTTPException(status_code=502, detail=f"Failed to connect to backend service: {e}")

async def consume_stream_from_redis(stream_id: str):
    """Consumes chunks from a Redis stream for a given stream_id and yields them."""
    stream_key = f"stream:{stream_id}"
    # The consumer and group should also be tied to the unique stream_id
    consumer_name = f"consumer:{stream_id}"
    group_name = f"group:{stream_id}"

    try:
        # Create a unique consumer group for this session.
        await redis.execute(["XGROUP", "CREATE", stream_key, group_name, "0", "MKSTREAM"])
    except Exception as e:
        # If the group already exists, it's not a critical error.
        if "BUSYGROUP" not in str(e):
            logger.warning(
                "Could not create consumer group (it might already exist)",
                extra={"stream_id": stream_id, "error": str(e)},
            )

    logger.info("Starting to consume from Redis stream", extra={"stream_id": stream_id, "consumer_name": consumer_name, "group_name": group_name})

    # This is the core of the recovery logic. We start by asking for messages
    # that were delivered to this consumer but never acknowledged (`0-0`).
    # After we process all pending messages, this ID will be set to `>` to
    # listen for new messages.
    last_processed_id = "0-0"
    
    # For latency optimization
    poll_interval = 0.1  # Start with 100ms polling
    max_poll_interval = 2.0  # Max 2s between polls
    consecutive_empty_reads = 0
    start_time = datetime.datetime.now()
    max_idle_time = 15  # 15 seconds of no data
 

    while True:
        try:
            # Non-blocking XREADGROUP (no BLOCK parameter for Upstash compatibility)
            response = await redis.execute([
                "XREADGROUP", "GROUP", group_name, consumer_name, 
                "COUNT", "10", "STREAMS", stream_key, last_processed_id
            ])
            
            logger.debug("XREADGROUP response", extra={
                "stream_id": stream_id, 
                "response": response, 
                "last_processed_id": last_processed_id
            })

            # Check if we got any data
            has_data = (response and len(response) > 0 and 
                       len(response[0]) >= 2 and response[0][1] and len(response[0][1]) > 0)
            
            if not has_data:
                if last_processed_id == "0-0":
                    # No pending messages, switch to listening for new ones
                    last_processed_id = ">"
                    logger.debug("No pending messages, switching to listen for new messages", extra={"stream_id": stream_id})
                    # Reset polling interval for new message mode
                    poll_interval = 0.1
                    consecutive_empty_reads = 0
                    continue
                else:
                    # No new messages, implement adaptive polling
                    consecutive_empty_reads += 1
                    
                    # Exponential backoff: increase polling interval when no data
                    if consecutive_empty_reads > 5:  # After 5 empty reads
                        poll_interval = min(poll_interval * 1.5, max_poll_interval)
                    
                    # Timeout after 15 seconds of no data, greater than client's 12sec timeout.
                    elapsed_time = datetime.datetime.now() - start_time
                    if elapsed_time.total_seconds() > max_idle_time:
                        logger.info("Stream timeout reached, ending consumption", extra={"stream_id": stream_id})
                        
                        yield f"data: [Stream timeout: No response from AI]\n\n"
                        yield f"data: [END_OF_STREAM]\n\n"
                        return
                    
                    logger.debug("No new messages, sleeping", extra={
                        "stream_id": stream_id, 
                        "poll_interval": poll_interval,
                        "consecutive_empty_reads": consecutive_empty_reads
                    })
                    
                    import asyncio
                    await asyncio.sleep(poll_interval)
                    continue  # This is the key - continue the loop to call XREADGROUP again
            
            # We got data! Reset polling optimizations
            poll_interval = 0.1
            consecutive_empty_reads = 0
            
            # Parse the response structure: [[stream_key, [[message_id, [field, value, ...]], ...]]]
            stream_name, messages = response[0]

            logger.debug("Processing messages", extra={"stream_id": stream_id, "message_count": len(messages)})

            for message_entry in messages:
                if len(message_entry) < 2:
                    continue
                    
                message_id = message_entry[0]
                field_value_pairs = message_entry[1]
                
                # Parse field-value pairs: [field1, value1, field2, value2, ...]
                data = {}
                for i in range(0, len(field_value_pairs), 2):
                    if i + 1 < len(field_value_pairs):
                        field = field_value_pairs[i]
                        value = field_value_pairs[i + 1]
                        data[field] = value
                
                chunk = data.get('chunk')
                if chunk == "[END_OF_STREAM]":
                    logger.info("End of stream marker received from Redis", extra={"stream_id": stream_id})
                    await redis.execute(["XACK", stream_key, group_name, message_id])
                    return
            
                if chunk:
                                        
                    # This is the key SSE formatting fix.
                    # It must be `data: ...` and end with two newlines.
                    message_data = chunk
                    if not isinstance(message_data, str):
                        message_data = message_data.decode('utf-8')
                    
                    sse_message = f"data: {message_data}\n\n"
                    yield sse_message.encode('utf-8')

                # Acknowledge the message *after* we have successfully yielded it to the client.
                await redis.execute(["XACK", stream_key, group_name, message_id])
                
                # If we were processing pending messages, we update the ID to continue
                # from this point in the pending list.
                if last_processed_id != ">":
                    last_processed_id = message_id

        except Exception as e:
            logger.error("Error in consume_stream_from_redis", extra={
                "stream_id": stream_id, 
                "error": str(e), 
                "error_type": type(e).__name__
            })
            # Small delay to prevent tight error loops
            import asyncio
            await asyncio.sleep(1)


@app.post("/api/chat")
async def handle_chat_data(fastapi_request: FastAPIRequest):
    # 1. Apply Rate Limiting based on client IP.
    client_host = fastapi_request.client.host if fastapi_request.client else "unknown"
    identifier = f"ratelimit:{client_host}"
    
    # fail-open if upstash_ratelimit check fails
    # run in threadpool to avoid blocking the event loop
    try:
        result = await run_in_threadpool(ratelimit.limit, identifier)
        success = result[0] if isinstance(result, (list, tuple)) else result
    except Exception as e:
        logger.exception("Ratelimit check failed, allowing request", extra={"error": str(e)})
        success = True # fail-open

    if not success:
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")

    # 2. Extract request, generate a UNIQUE stream_id for this request.
    try:
        chat_request = await fastapi_request.json()
        content = sanitize_content(chat_request.get("content", ""))
    except ValueError as e:
        # Graceful handling of malicious content
        async def sanitization_error_stream():
            yield f"data: [Error: {str(e)}]\n\n"
            yield "data: [END_OF_STREAM]\n\n"
        
        return StreamingResponse(
            sanitization_error_stream(),
            media_type="text/event-stream",
            headers={'Cache-Control': 'no-cache'}
        )
    except Exception as e:
        # Graceful handling of JSON parsing errors
        async def json_error_stream():
            yield "data: [Error: Invalid request format]\n\n"
            yield "data: [END_OF_STREAM]\n\n"
        
        return StreamingResponse(
            json_error_stream(),
            media_type="text/event-stream",
            headers={'Cache-Control': 'no-cache'}
        )

  
  
    thread_id = chat_request.get("thread_id") # Keep existing thread_id for history
    stream_id = str(uuid.uuid4()) # Generate a new, unique ID for this specific stream

    backend_request = {
        "content": content,
    }

    # 3. Trigger the backend to start generation.
    try:    
        await trigger_stream_generation(thread_id, stream_id, backend_request)
    except HTTPException as e:
        async def error_stream():
            yield f"data: [Backend service unavailable]:{e.detail}\n\n"
            yield "data: [END_OF_STREAM]\n\n"

        return StreamingResponse(
            error_stream(), 
            media_type="text/event-stream",
            headers={
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'close',
                'X-Accel-Buffering': 'no'
            }
        )
    
    # 4. Return a streaming response that consumes from the unique stream_id
    #    and includes the stream_id in a header for client-side recovery.
    headers = {
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Stream-Id': stream_id # Custom header to send the ID to the client
    }
    return StreamingResponse(
        consume_stream_from_redis(stream_id),
        media_type='text/event-stream',
        headers=headers
    )

@app.get("/api/recover/{stream_id}")
async def recover_chat_stream(stream_id: str):
    """
    Allows a client to recover a stream using its unique stream_id.
    """
    logger.info("Recovery request received", extra={"stream_id": stream_id})
    return StreamingResponse(
        consume_stream_from_redis(stream_id),
        media_type="text/event-stream",
        headers={
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'close',
            'X-Accel-Buffering': 'no'
        }
    )

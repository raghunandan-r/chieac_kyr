# chieac.fyi

TUI inspired front end for my personal portfolio. 

## Architecture

### Durable Streaming with Redis
The application now implements a robust, fault-tolerant streaming architecture using Redis Streams:

- **Decoupled Architecture**: Frontend proxy (`api/index.py`) triggers backend generation and consumes from Redis
- **Durable Streams**: Redis Streams provide persistence, enabling stream recovery after network interruptions
- **Fault Tolerance**: Client-side recovery logic automatically reconnects to streams using unique `stream_id`s
- **Rate Limiting**: Built-in protection using Upstash Redis with sliding window rate limiting

### Key Components
- **Client** (`hooks/use-chat-stream.ts`): Handles user input, displays streams, and manages recovery
- **Proxy** (`api/index.py`): Manages Redis consumer groups, triggers backend generation, and streams to client
- **Backend** (`chatchieac-backend`): Generates AI responses and writes to Redis Streams
- **Redis** (Upstash): Persistent message broker enabling durable, recoverable streams

### Technical Features
- **Stream Recovery**: Automatic reconnection to interrupted streams using `/api/recover/{stream_id}`
- **Consumer Groups**: Persistent Redis consumer groups track message delivery state
- **Adaptive Polling**: Optimized polling intervals for Upstash Redis compatibility
- **Input Sanitization**: Comprehensive content filtering to prevent injection attacks
- **Error Handling**: Graceful degradation with detailed logging and user feedback

## Goals
- Smooth, low-jitter streaming TUI.
- Minimal client JS and dependencies.
- Keep server streaming unchanged.
- DRY terminal: reuse icons, keep CSS local to the component, extract large constants if helpful.
- **Durable streaming**: No data loss on network interruptions or client disconnections.
- **Fault tolerance**: Automatic recovery from backend failures and connection drops.

## Learn More

To learn more about the AI SDK or Next.js by Vercel, take a look at the following resources:

- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [your website should be under 14kb in size](https://endtimes.dev/why-your-website-should-be-under-14kb-in-size/)
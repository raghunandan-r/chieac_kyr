import logging
import os
import sys
import json
from datetime import datetime
from typing import Any
from pythonjsonlogger import jsonlogger
from dotenv import load_dotenv
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

# Load .env files only if they exist
if os.path.exists('.env'):
    load_dotenv('.env')
else:
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),    
        environment="production",  
        traces_sample_rate=1.0,   
        profiles_sample_rate=1.0, 
        integrations=[
            FastApiIntegration(),
            AsyncioIntegration(),
            # ADD THIS: LoggingIntegration for capturing logs
            LoggingIntegration(
                level=logging.INFO,        # Capture INFO+ as breadcrumbs
                event_level=logging.INFO,  # Send INFO+ as events to Sentry
            ),
        ],
        send_default_pii=True,
        # Enable logs to be sent to Sentry
        enable_logs=True,
        _experiments={
            "continuous_profiling_auto_start": True,        
        },
    )
    
    logger = logging.getLogger()  # Root logger
    logger.error("SENTRY TEST: This error should appear in Issues")
    logger.info("SENTRY TEST: This info should appear somewhere")


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record: dict[str, Any], record: logging.LogRecord, message_dict: dict[str, Any]) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record.update({
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "environment": "production" if not sys.gettrace() else "development",
            "service": "nextjs-api"
        })

def setup_logger():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(CustomJsonFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s'
    ))
    logger.addHandler(console_handler)
    
    return logger



logger = setup_logger() 
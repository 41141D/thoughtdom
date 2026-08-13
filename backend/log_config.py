"""
Minimal logging configuration for ThoughtDom.

Privacy-first by design: the default uvicorn access log records every
visitor's IP address on every request -- exactly the metadata this
platform exists to avoid collecting. This config disables the default
access log and keeps only application-level logs (no client metadata).
"""
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": True,
    "loggers": {
        # Silence uvicorn's default access logger that records client IPs.
        "uvicorn.access": {"handlers": [], "level": "CRITICAL", "propagate": False},
        "uvicorn.error": {"handlers": [], "level": "ERROR", "propagate": False},
        # Keep only application logs; no client metadata is ever logged.
        "thoughtdom": {"handlers": [], "level": "WARNING", "propagate": False},
        # FastAPI/Starlette error paths must remain visible for debugging.
        "fastapi": {"handlers": [], "level": "ERROR", "propagate": False},
    },
}

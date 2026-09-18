import os
import time
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from backend.config import settings
from backend.limiter import limiter
from backend.api.routes import scout, simulate, upload
import uvicorn

# 1.2 Structured logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("catalyst_scout")

# Optional Sentry initialization (Phase 2 Observability)
if settings.sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            traces_sample_rate=0.2,
            environment=settings.environment,
        )
        logger.info("Sentry error monitoring initialized.")
    except Exception as se:
        logger.warning(f"Sentry SDK initialization skipped: {se}")

app = FastAPI(title="Catalyst Scout v2 API", version="2.0.0")

# 0.3 Rate limiter state registration
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 0.2 Security headers middleware & Phase 2 Structured request logging
@app.middleware("http")
async def security_and_logging_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = int((time.time() - start_time) * 1000)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Request observability (Never logs PII or candidate secrets)
    if request.url.path not in ("/health", "/favicon.ico"):
        logger.info(
            f"[HTTP] {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)"
        )

    return response

# Tightened CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_origins,
    allow_credentials=settings.parsed_origins != ["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-User-Api-Key", "X-GitHub-Token", "Accept"],
)

app.include_router(scout.router, tags=["Scout"])
app.include_router(simulate.router, tags=["Simulate"])
app.include_router(upload.router, tags=["Upload"])

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": int(time.time()),
        "environment": settings.environment
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=settings.port)

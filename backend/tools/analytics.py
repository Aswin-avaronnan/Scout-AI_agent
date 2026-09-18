import asyncio
import logging
import time
from typing import Optional, Dict, Any
import httpx
from backend.config import settings

logger = logging.getLogger(__name__)

async def _send_supabase_event(event_data: Dict[str, Any]):
    """Sends analytics event to Supabase asynchronously if configured."""
    if not settings.supabase_url or not settings.supabase_key:
        return

    endpoint = f"{settings.supabase_url.rstrip('/')}/rest/v1/analytics_events"
    headers = {
        "apikey": settings.supabase_key,
        "Authorization": f"Bearer {settings.supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(endpoint, json=event_data, headers=headers)
            if resp.is_error:
                logger.warning(f"Supabase analytics event failed: {resp.status_code}")
    except Exception as e:
        logger.warning(f"Failed to transmit analytics event to Supabase: {e}")

def track_event(
    event_type: str,
    provider: Optional[str] = None,
    candidate_count: Optional[int] = None,
    duration_ms: Optional[int] = None,
    success: bool = True,
    error_type: Optional[str] = None,
    session_id: Optional[str] = None
):
    """
    Safely records high-level usage/funnel metrics.
    NEVER logs or stores candidate PII, JD text, or credentials.
    """
    event_payload = {
        "event_type": event_type,
        "provider": provider,
        "candidate_count": candidate_count,
        "duration_ms": duration_ms,
        "success": success,
        "error_type": error_type,
        "session_id": session_id
    }

    # Structured local log
    logger.info(
        f"[ANALYTICS] event={event_type} provider={provider} "
        f"candidates={candidate_count} duration={duration_ms}ms "
        f"success={success} error={error_type}"
    )

    # Fire background task if Supabase is configured
    if settings.supabase_url and settings.supabase_key:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_send_supabase_event(event_payload))
        except RuntimeError:
            pass

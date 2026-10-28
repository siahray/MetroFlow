"""Fixed-window rate limiting backed by the application database.

The API is publicly reachable, so the routes that are worth abusing --- password
guessing, account creation, fake SOS reports and the simulation that rewrites
every edge --- need a request ceiling (TSD LIM-006).

The counter cannot live in this process: on a serverless host every request may
land on a different instance, and an in-process dictionary would reset on every
cold start. The edge would be the natural place for it, but rate limiting is a
paid Vercel feature and this deployment runs on the free plan. The database is
already the system of record, is reachable from every instance, and needs no new
service, so the counter is one atomic upsert per limited request:

    INSERT ... ON CONFLICT (bucket, window_start) DO UPDATE ... RETURNING count

Windows are aligned to the epoch instead of starting on first contact. That keeps
the statement above sufficient --- no row is needed to open a window --- and
makes the guarantee easy to state: a client gets at most ``limit`` requests
inside any aligned window of ``window_seconds``.
"""

from __future__ import annotations

import logging
import time

from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import SessionLocal

logger = logging.getLogger("metroflow.rate_limit")

_CONSUME_SQL = text(
    """
    INSERT INTO rate_limit_counters (bucket, window_start, request_count)
    VALUES (:bucket, :window_start, 1)
    ON CONFLICT (bucket, window_start)
    DO UPDATE SET request_count = rate_limit_counters.request_count + 1
    RETURNING request_count
    """
)

# Windows older than this can never match a rule again, so the rows are dead
# weight. Cleanup runs once per process start rather than on a schedule: on the
# hosted deployment a cold start is frequent, and a full table scan of a few
# thousand rows is cheaper than a cron job.
_PRUNE_SQL = text("DELETE FROM rate_limit_counters WHERE window_start < :cutoff")


def client_id(request: Request) -> str:
    """Best-effort identity for the counter key.

    On Vercel the platform overwrites ``X-Forwarded-For``, so its first entry is
    the caller. Locally there is no proxy and the socket address is used. Behind
    a proxy that forwards the header without replacing it, this would be
    spoofable --- which is one more reason not to put this API behind one.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first

    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()

    return request.client.host if request.client else "unknown"


def consume(
    db: Session,
    bucket: str,
    window_seconds: int,
    now: float | None = None,
) -> tuple[int, int]:
    """Count one request in the current window.

    Returns ``(requests_in_window_including_this_one, window_start)``. The caller
    owns the transaction; the increment is committed here because the endpoint
    may go on to raise, and a failed login must still count.
    """
    moment = time.time() if now is None else now
    window_start = int(moment // window_seconds) * window_seconds
    count = db.execute(
        _CONSUME_SQL,
        {"bucket": bucket, "window_start": window_start},
    ).scalar_one()
    db.commit()
    return int(count), window_start


def prune(db: Session, keep_seconds: int = 3600) -> int:
    """Delete windows that are too old to be matched again."""
    result = db.execute(_PRUNE_SQL, {"cutoff": int(time.time()) - keep_seconds})
    db.commit()
    return result.rowcount or 0


def rate_limit(name: str, limit: int, window_seconds: int = 60):
    """Build a dependency allowing ``limit`` requests per window per client.

    ``name`` scopes the counter, so two routes never share a quota. A limit of
    zero or less disables the check, which the test suite relies on.
    """

    def dependency(request: Request) -> None:
        if limit <= 0:
            return

        bucket = f"{name}:{client_id(request)}"
        try:
            with SessionLocal() as db:
                count, window_start = consume(db, bucket, window_seconds)
        except SQLAlchemyError:
            # Fail open. A database that cannot answer is already breaking the
            # endpoints that matter, and turning that into a 429 would hide the
            # real fault; the log line is what tells an operator the ceiling was
            # not enforced.
            logger.warning("rate limit unavailable for %s; request allowed", bucket, exc_info=True)
            return

        if count > limit:
            retry_after = max(1, window_start + window_seconds - int(time.time()))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

    # The route-wiring test finds these dependencies by attribute, the same way
    # the authorisation tests match on the callable itself.
    dependency.limit_name = name  # type: ignore[attr-defined]
    dependency.__name__ = f"rate_limit_{name}"

    return dependency

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Settings() reads ``.env`` for the prefixed fields, but that does not populate
# os.environ, which the non-prefixed variables (DATABASE_URL, REDIS_URL) rely on.
load_dotenv()


class Settings(BaseSettings):
    """
    Central configuration for the MetroFlow simulation engine.

    Every value is overridable from the environment (prefix ``METROFLOW_``),
    so calibration can be tuned per-deployment without touching code.
    """

    model_config = SettingsConfigDict(
        env_prefix="METROFLOW_",
        env_file=".env",
        extra="ignore",
        # Lets tests build a Settings with field names instead of env aliases.
        populate_by_name=True,
    )

    # --- Runtime mode ----------------------------------------------------------
    # ``FASTAPI_ENV`` deliberately carries no prefix: it is a deployment switch,
    # not a calibration knob. The alias means the prefix is not applied.
    fastapi_env: str = Field(default="development", validation_alias="FASTAPI_ENV")

    # --- CORS ------------------------------------------------------------------
    # Comma-separated browser origins. The default keeps the pilot reachable from
    # any port on any host; an explicit allowlist is required before exposure
    # (TSD SEC-002 / LIM-005).
    cors_origins: str = Field(default="*", validation_alias="METROFLOW_CORS_ORIGINS")

    # --- Hydrology calibration -------------------------------------------------
    # SCS-CN Curve Number for urban concrete / asphalt catchments.
    curve_number: int = 85
    # Assumed storm duration used to convert mm/hr intensity into mm of rainfall.
    rainfall_duration_hrs: float = 1.0
    # Converts catchment-wide runoff depth (mm) into point street ponding depth.
    # This is a *calibration* coefficient, not a physical constant: it stands in
    # for the depression-storage / drainage-area ratio of a low-lying road
    # segment. Replace with a DEM + drainage-network model when available.
    ponding_amplification: float = 3.5

    # --- Passability thresholds ------------------------------------------------
    # Depth at or above which a road is a "light flood" caution (but passable).
    caution_depth_cm: float = 10.0
    # Default vehicle clearance used when the client does not supply one.
    default_clearance_cm: float = 30.0

    # --- Flood state (CR-004) --------------------------------------------------
    # A live reading counts for this long after the time it applies to. Past it the
    # reading is stale and the segment falls back to the next source; silence is
    # never treated as "safe".
    flood_fresh_minutes: int = 30
    # Fetch Open-Meteo rain for the corridor when flood-state is polled (at most
    # once per 10 minutes). The suite and any deployment whose egress to
    # api.open-meteo.com is blocked turn this off.
    weather_ingest: bool = True
    # Fetch the Open-Meteo Flood API's modelled GloFAS river discharge when
    # flood-state is polled (at most once per 20 minutes). Same egress as
    # weather_ingest; the suite turns this off too.
    river_discharge_ingest: bool = True

    # --- Bootstrap dispatcher --------------------------------------------------
    # Registration only ever creates driver accounts, so the first LGU
    # dispatcher has to come from configuration. These values are used once, when
    # the user table is empty; set both in any real deployment.
    admin_email: str = "dispatcher@metroflow.local"
    admin_password: str = "metroflow-dev"

    # --- Request ceilings ------------------------------------------------------
    # Requests per minute per client address for the routes worth abusing
    # (TSD LIM-006). The defaults are sized for a handful of operators on one
    # connection: a dispatcher signs in a few times a minute at most, a driver
    # sends one SOS, and the simulation is a deliberate act. Zero disables a
    # limit, which the test suite uses.
    rate_limit_login_per_min: int = 15
    rate_limit_register_per_min: int = 10
    rate_limit_sos_per_min: int = 20
    rate_limit_simulation_per_min: int = 12
    rate_limit_reports_per_min: int = 12

    # --- Field reports ---------------------------------------------------------
    # A report's reporter is stored as a salted hash, never as a user id
    # (BR-011). The salt is configuration so a deployment can choose its own;
    # rotating it breaks de-duplication history but no other behaviour.
    report_hash_salt: str = "metroflow-report-salt"
    # Evidence images are held in the report row, so the ceiling is what keeps
    # a single row small enough for the database and the function response. It
    # sits under Vercel's ~4.5 MB request-body limit: a 4 MB photo plus the
    # multipart envelope still fits, so the API rejects an oversized upload with
    # its own 413 instead of the platform rejecting the whole request first.
    report_photo_max_bytes: int = 4 * 1024 * 1024
    # A pending report inside this radius and window is a corroborating
    # neighbour (raises urgency) and a possible duplicate (flagged, not dropped).
    report_duplicate_radius_m: int = 150
    report_duplicate_window_minutes: int = 15

    # --- Driver navigation (FSD-FR-063) ----------------------------------------
    # How close a driver has to be to a verified hazard before the app raises a
    # proximity alert. 200 m is about the braking plus decision distance at the
    # corridor's 50 km/h limit, and the TSD lists the value as configurable.
    warning_radius_m: int = 200

    # --- Dry-state routing provider --------------------------------------------
    # Used only when routing_mode() has already decided every edge in the graph
    # is clear (no water, advisory or closure anywhere): a real road network and
    # live traffic serve a plain fastest path better than our own graph, which
    # was built to carry flood state, not drive quality. FLOOD_SAFE never uses
    # this -- only the in-house TD-A* engine knows about water depth and
    # vehicle clearance. A missing token or a failed call falls back to that
    # same in-house engine, so Mapbox being unset or down never breaks routing.
    mapbox_access_token: str | None = Field(
        default=None, validation_alias="METROFLOW_MAPBOX_ACCESS_TOKEN"
    )
    mapbox_directions_enabled: bool = True

    # --- Vehicle telemetry (FSD-FR-072) ---------------------------------------
    # Minimum interval in seconds between telemetry updates for a vehicle.
    # Batches arriving faster than this are rejected with 429 (VAL-020, TTC-022).
    telemetry_min_seconds: int = 5

    # --- Event streams (FSD-FR-086) --------------------------------------------
    # The relays read the event log on a short timer rather than through a broker
    # (ADR-024). NFR-019 budgets 100 ms p95 for the whole publish-to-delivery
    # path, so the poll interval itself has to sit well under that -- a 100 ms
    # poll alone puts the p95 wait near 95 ms before any processing time is
    # added (measured: ~110 ms median, ~220-330 ms p95, over budget). 40 ms
    # keeps the p95 wait near 38 ms and leaves headroom; the query is an index
    # probe on (channel, event_id), so 25 reads a second per client still costs
    # little.
    event_stream_poll_ms: int = 40
    # A serverless function cannot hold a socket open forever, so a stream ends
    # on its own and the client reconnects with Last-Event-ID. Forty-five seconds
    # sits inside the sixty-second function limit with room for startup.
    event_stream_lifetime_seconds: int = 45
    # A comment frame this often keeps proxies from treating an idle stream as
    # dead, without waking the client's parser.
    event_stream_heartbeat_seconds: int = 10
    # One tail query never returns more than this; a lagging client catches up in
    # batches on the next pass instead of buffering the whole backlog in memory.
    event_stream_batch: int = 200

    # --- Database pool --------------------------------------------------------
    # Sized for a serverless deployment: many short-lived function instances each
    # hold their own small pool, so keeping this low avoids the sum exhausting
    # the hosted DB's own connection limit. A single long-running process (the
    # local `uvicorn --reload` dev server) is a different shape -- it alone opens
    # one SSE stream per live overlay (hazards, fleet, SOS), each holding a
    # pooled connection for up to `event_stream_lifetime_seconds`, so a couple of
    # open browser tabs can exhaust 5 total connections and start timing out
    # ordinary requests. Override both via the environment for local dev;
    # production keeps these defaults.
    db_pool_size: int = 2
    db_max_overflow: int = 3

    @property
    def is_production(self) -> bool:
        """True only for ``FASTAPI_ENV=production``, case and padding aside."""
        return self.fastapi_env.strip().lower() == "production"

    @property
    def is_development(self) -> bool:
        """True only for ``FASTAPI_ENV=development``; gates the demo seed."""
        return self.fastapi_env.strip().lower() == "development"

    @property
    def cors_origin_list(self) -> list[str]:
        """The CORS allowlist, never empty (an empty value means any origin)."""
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        return origins or ["*"]


settings = Settings()

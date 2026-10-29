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
    # a single row small enough for the database and the function response.
    report_photo_max_bytes: int = 5 * 1024 * 1024
    # A pending report inside this radius and window is a corroborating
    # neighbour (raises urgency) and a possible duplicate (flagged, not dropped).
    report_duplicate_radius_m: int = 150
    report_duplicate_window_minutes: int = 15

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

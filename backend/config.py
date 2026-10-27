from dotenv import load_dotenv
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
    )

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


settings = Settings()

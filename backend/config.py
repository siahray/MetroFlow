import os

from pydantic_settings import BaseSettings, SettingsConfigDict


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


settings = Settings()

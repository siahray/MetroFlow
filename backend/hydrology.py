from typing import Optional

from config import settings

# ---------------------------------------------------------------------------
# SCS Curve Number surface runoff
# ---------------------------------------------------------------------------


def calculate_scs_cn_runoff(
    rainfall_mm_hr: float,
    curve_number: Optional[int] = None,
    duration_hrs: Optional[float] = None,
) -> float:
    """
    Calculates direct surface runoff depth (mm) using the SCS-CN model.

    P:  Total rainfall in mm (intensity x duration)
    CN: Curve Number (e.g. 85 for urban concrete/asphalt)
    """
    cn = settings.curve_number if curve_number is None else curve_number
    duration = settings.rainfall_duration_hrs if duration_hrs is None else duration_hrs

    P = rainfall_mm_hr * duration
    if P <= 0:
        return 0.0

    # Potential maximum retention after runoff begins (S)
    S = (25400.0 / cn) - 254.0

    # Initial abstraction (Ia) = 0.2 * S
    Ia = 0.2 * S

    if P <= Ia:
        return 0.0

    # Direct runoff Q (mm)
    Q = ((P - Ia) ** 2) / (P - Ia + S)
    return float(Q)


def compute_node_water_depth(
    runoff_mm: float,
    slope_percent: float = 1.0,
    elevation_m: float = 5.0,
    amplification: Optional[float] = None,
) -> float:
    """
    Converts surface runoff (mm) into street ponding water depth (cm),
    factoring in low-lying elevation accumulation.

    The SCS-CN model yields runoff depth spread across an entire catchment.
    Street flooding is a much more localised quantity: water concentrates in
    low-lying depressions. ``PONDING_AMPLIFICATION`` bridges those two scales
    and is deliberately exposed as configuration rather than hidden in the
    formula, so it can be replaced by a real DEM/drainage model later.
    """
    amp = settings.ponding_amplification if amplification is None else amplification

    # Deeper ponding at lower elevations (clamped to a 10 m reference datum).
    depression_factor = 1.0 + (10.0 - min(elevation_m, 10.0)) * 0.15
    base_depth_cm = (runoff_mm / 10.0) * depression_factor * amp

    return round(float(max(0.0, base_depth_cm)), 2)

"""Pure geometry helpers shared between floor-plan validation and AI-assisted
generation. No DB/framework imports here on purpose - both `app/api/routes/floor_plans.py`
and `app/services/floor_plan_ai.py` depend on this module, so it must not depend on either.
"""
import math
from typing import Tuple

AABB = Tuple[float, float, float, float]  # (min_x, min_y, max_x, max_y)


def rotated_aabb(x: float, y: float, width: float, height: float, rotation_deg: float) -> AABB:
    """Axis-aligned bounding box of a width x height rectangle whose top-left corner
    is (x, y) pre-rotation, rotated by rotation_deg around its own center. A
    conservative-but-correct bounds check for every supported shape: a circle/oval's
    own rotated footprint never exceeds its bounding rectangle's, and L-shape/custom
    are edited as a bounding box today (see design doc's stated shape-fidelity scope).
    """
    theta = math.radians(rotation_deg or 0)
    cos_t, sin_t = abs(math.cos(theta)), abs(math.sin(theta))
    rotated_w = width * cos_t + height * sin_t
    rotated_h = width * sin_t + height * cos_t
    cx, cy = x + width / 2, y + height / 2
    return cx - rotated_w / 2, cy - rotated_h / 2, cx + rotated_w / 2, cy + rotated_h / 2


def aabb_overlap(a: AABB, b: AABB, tolerance: float = 0.5) -> bool:
    """True if two AABBs overlap by more than `tolerance` px on both axes. The
    tolerance avoids flagging rooms that are merely touching/adjacent (e.g. sharing
    a wall), which is a legitimate layout, not a conflict."""
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    overlap_x = min(ax1, bx1) - max(ax0, bx0)
    overlap_y = min(ay1, by1) - max(ay0, by0)
    return overlap_x > tolerance and overlap_y > tolerance

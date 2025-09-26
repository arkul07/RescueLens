"""
Pydantic models for the RescueLens backend API.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from datetime import datetime


class PatientState(BaseModel):
    """Patient state data from frontend."""
    id: str
    bbox: Dict[str, float]  # {x, y, w, h} normalized 0..1
    rr_bpm: Optional[float] = None
    breathing: Optional[bool] = None  # true/false/unknown
    movement: str  # "purposeful" | "low" | "none" | "unknown"
    audio: Optional[Dict[str, Any]] = None  # {distressKeyword?, breathingPresent?, snr?}
    signal_q: float  # 0..1 ROI stability/quality
    det_conf: float  # 0..1 detector confidence
    ts: int  # epoch ms


class TriageDecision(BaseModel):
    """Triage decision response."""
    id: str
    category: str  # "RED" | "YELLOW" | "GREEN" | "BLACK" | "UNKNOWN"
    confidence: float  # 0..1
    reason: str  # e.g., "RR=34; No purposeful movement"
    ts: int


class OverrideRequest(BaseModel):
    """Human override request."""
    id: str
    category: str  # "RED" | "YELLOW" | "GREEN" | "BLACK" | "UNKNOWN"
    reason: str
    ts: int


class EventLogEntry(BaseModel):
    """Event log entry."""
    id: str
    timestamp: int
    ai: bool  # true for AI decisions, false for overrides
    patient_id: str
    category: str
    confidence: float
    reason: str
    override_reason: Optional[str] = None


class WebSocketMessage(BaseModel):
    """WebSocket message wrapper."""
    type: str
    data: Optional[Dict[str, Any]] = None
    decision: Optional[TriageDecision] = None

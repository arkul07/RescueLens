"""
START-like triage rules implementation.
"""

from typing import Tuple
from models import PatientState, TriageDecision


def triage_decision(state: PatientState) -> Tuple[str, float, str]:
    """
    Apply START-like triage rules to determine patient category.
    
    Returns:
        Tuple of (category, confidence, reason)
    """
    
    # Initialize reason components
    reasons = []
    confidence_factors = []
    
    # Rule 1: Unknown/weak signal → UNKNOWN
    if state.signal_q < 0.3 or state.det_conf < 0.3:
        return "UNKNOWN", 0.5, "Low visibility / weak signal"
    
    # Rule 2: Not breathing (visual) AND no audio breathing → RED
    if state.breathing is False:
        if state.audio and state.audio.get('breathingPresent') is False:
            return "RED", 0.9, "No chest motion and no audio breathing"
        elif not state.audio or state.audio.get('breathingPresent') is None:
            return "RED", 0.8, "No chest motion"
    
    # Rule 3: RR > 30 or RR < 10 → RED
    if state.rr_bpm is not None:
        if state.rr_bpm > 30:
            reasons.append(f"RR={state.rr_bpm:.0f}")
            confidence_factors.append(0.9)
        elif state.rr_bpm < 10:
            reasons.append(f"RR={state.rr_bpm:.0f}")
            confidence_factors.append(0.9)
    
    # Rule 4: Breathing but unresponsive (movement "low/none") → YELLOW
    if state.breathing is True and state.movement in ["low", "none"]:
        reasons.append("Breathing but unresponsive")
        confidence_factors.append(0.7)
    
    # Rule 5: Audio keyword analysis
    if state.audio and state.audio.get('distressKeyword'):
        keyword = state.audio['distressKeyword']
        if keyword in ["help", "cant_breathe"]:
            if not reasons or "RED" not in reasons:
                reasons.append(f"Distress keyword: {keyword}")
                confidence_factors.append(0.6)
        elif keyword == "im_ok" and state.movement == "purposeful":
            reasons.append("Patient reports OK with purposeful movement")
            confidence_factors.append(0.8)
    
    # Rule 6: Default classification
    if not reasons:
        if state.breathing is True and state.movement == "purposeful":
            return "GREEN", 0.7, "Breathing normally, purposeful movement"
        elif state.breathing is True:
            return "YELLOW", 0.6, "Breathing but limited movement"
        else:
            return "UNKNOWN", 0.5, "Insufficient data for classification"
    
    # Determine final category based on rules
    if any("RR=" in reason for reason in reasons):
        category = "RED"
        confidence = max(confidence_factors) if confidence_factors else 0.8
    elif "Distress keyword" in " ".join(reasons):
        category = "YELLOW"
        confidence = max(confidence_factors) if confidence_factors else 0.6
    elif "Breathing but unresponsive" in reasons:
        category = "YELLOW"
        confidence = max(confidence_factors) if confidence_factors else 0.7
    elif "Patient reports OK" in " ".join(reasons):
        category = "GREEN"
        confidence = max(confidence_factors) if confidence_factors else 0.8
    else:
        category = "UNKNOWN"
        confidence = 0.5
    
    # Combine reasons
    reason = "; ".join(reasons)
    
    # Adjust confidence based on signal quality
    confidence = min(confidence * state.signal_q * state.det_conf, 1.0)
    
    return category, confidence, reason


def create_triage_decision(state: PatientState) -> TriageDecision:
    """Create a triage decision for a patient state."""
    category, confidence, reason = triage_decision(state)
    
    return TriageDecision(
        id=state.id,
        category=category,
        confidence=confidence,
        reason=reason,
        ts=state.ts
    )

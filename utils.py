"""
Utility functions for the AI-assisted triage system.
"""

import json
import csv
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import numpy as np
import cv2


@dataclass
class PatientState:
    """Structured patient state object."""
    id: str
    timestamp: float
    breathing_rate: float
    is_breathing: bool
    is_responsive: bool
    movement_score: float
    confidence: float
    bounding_box: tuple  # (x1, y1, x2, y2)
    position: tuple  # (center_x, center_y)


@dataclass
class TriageDecision:
    """Triage decision with confidence and override capability."""
    patient_id: str
    timestamp: float
    ai_suggestion: str  # RED, YELLOW, GREEN, BLACK
    confidence: float
    human_override: Optional[str] = None
    final_decision: Optional[str] = None
    reasoning: str = ""


class EventLogger:
    """Real-time event logging system."""
    
    def __init__(self):
        self.events: List[Dict[str, Any]] = []
    
    def log_detection(self, patient_state: PatientState):
        """Log a patient detection event."""
        event = {
            "timestamp": patient_state.timestamp,
            "type": "detection",
            "patient_id": patient_state.id,
            "breathing_rate": patient_state.breathing_rate,
            "is_breathing": patient_state.is_breathing,
            "is_responsive": patient_state.is_responsive,
            "confidence": patient_state.confidence
        }
        self.events.append(event)
    
    def log_triage_decision(self, decision: TriageDecision):
        """Log a triage decision event."""
        event = {
            "timestamp": decision.timestamp,
            "type": "triage_decision",
            "patient_id": decision.patient_id,
            "ai_suggestion": decision.ai_suggestion,
            "confidence": decision.confidence,
            "human_override": decision.human_override,
            "final_decision": decision.final_decision,
            "reasoning": decision.reasoning
        }
        self.events.append(event)
    
    def export_csv(self, filename: str = "triage_log.csv"):
        """Export events to CSV file."""
        if not self.events:
            return
        
        # Get all possible fieldnames from all events
        all_fieldnames = set()
        for event in self.events:
            all_fieldnames.update(event.keys())
        
        # Convert to sorted list for consistent ordering
        fieldnames = sorted(list(all_fieldnames))
        
        with open(filename, 'w', newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            # Write each event, filling missing fields with empty strings
            for event in self.events:
                row = {field: event.get(field, '') for field in fieldnames}
                writer.writerow(row)
    
    def export_json(self, filename: str = "triage_log.json"):
        """Export events to JSON file."""
        # Convert events to JSON-serializable format
        serializable_events = []
        for event in self.events:
            serializable_event = {}
            for key, value in event.items():
                if isinstance(value, (str, int, float, bool, type(None))):
                    serializable_event[key] = value
                else:
                    serializable_event[key] = str(value)
            serializable_events.append(serializable_event)
        
        with open(filename, 'w') as jsonfile:
            json.dump(serializable_events, jsonfile, indent=2)


def calculate_optical_flow_magnitude(frame1: np.ndarray, frame2: np.ndarray, 
                                   region: tuple) -> float:
    """
    Calculate optical flow magnitude in a specific region.
    
    Args:
        frame1: Previous frame
        frame2: Current frame
        region: (x1, y1, x2, y2) bounding box
    
    Returns:
        Average optical flow magnitude in the region
    """
    x1, y1, x2, y2 = region
    
    # Extract region of interest
    roi1 = frame1[y1:y2, x1:x2]
    roi2 = frame2[y1:y2, x1:x2]
    
    if roi1.size == 0 or roi2.size == 0:
        return 0.0
    
    # Convert to grayscale if needed
    if len(roi1.shape) == 3:
        roi1 = cv2.cvtColor(roi1, cv2.COLOR_BGR2GRAY)
    if len(roi2.shape) == 3:
        roi2 = cv2.cvtColor(roi2, cv2.COLOR_BGR2GRAY)
    
    # Calculate frame difference
    diff = cv2.absdiff(roi1, roi2)
    return np.mean(diff)


def estimate_breathing_rate(flow_magnitudes: List[float], fps: float = 30) -> float:
    """
    Estimate breathing rate from optical flow magnitudes.
    
    Args:
        flow_magnitudes: List of optical flow magnitudes over time
        fps: Frames per second
    
    Returns:
        Estimated breathing rate (breaths per minute)
    """
    if len(flow_magnitudes) < 10:
        return 0.0
    
    # Simple peak detection for breathing cycles
    magnitudes = np.array(flow_magnitudes)
    
    # Smooth the signal
    from scipy.signal import savgol_filter
    if len(magnitudes) > 5:
        smoothed = savgol_filter(magnitudes, min(5, len(magnitudes)), 2)
    else:
        smoothed = magnitudes
    
    # Find peaks (breathing cycles)
    from scipy.signal import find_peaks
    peaks, _ = find_peaks(smoothed, height=np.mean(smoothed))
    
    if len(peaks) < 2:
        return 0.0
    
    # Calculate breathing rate
    time_span = len(flow_magnitudes) / fps
    breathing_cycles = len(peaks) - 1
    breathing_rate = (breathing_cycles / time_span) * 60
    
    return max(0, min(60, breathing_rate))  # Clamp to reasonable range


def calculate_movement_score(pose_landmarks: List, previous_landmarks: List) -> float:
    """
    Calculate movement score based on pose landmark changes.
    
    Args:
        pose_landmarks: Current pose landmarks
        previous_landmarks: Previous pose landmarks
    
    Returns:
        Movement score (0-1, higher = more movement)
    """
    if not pose_landmarks or not previous_landmarks:
        return 0.0
    
    if len(pose_landmarks) != len(previous_landmarks):
        return 0.0
    
    # Calculate average displacement
    displacements = []
    for curr, prev in zip(pose_landmarks, previous_landmarks):
        if curr.visibility > 0.5 and prev.visibility > 0.5:
            dx = curr.x - prev.x
            dy = curr.y - prev.y
            displacement = np.sqrt(dx*dx + dy*dy)
            displacements.append(displacement)
    
    if not displacements:
        return 0.0
    
    return np.mean(displacements)


def get_triage_color(decision: str) -> str:
    """Get color code for triage decision."""
    colors = {
        "RED": "#FF0000",
        "YELLOW": "#FFFF00", 
        "GREEN": "#00FF00",
        "BLACK": "#000000",
        "UNKNOWN": "#808080"
    }
    return colors.get(decision, "#808080")


def format_timestamp(timestamp: float) -> str:
    """Format timestamp for display."""
    return datetime.fromtimestamp(timestamp).strftime("%H:%M:%S.%f")[:-3]


def draw_patient_box(frame: np.ndarray, bbox: tuple, color: tuple, 
                    patient_id: str, triage_status: str, 
                    breathing_rate: float, confidence: float, 
                    signal_quality: float = 0.0) -> np.ndarray:
    """
    Draw patient bounding box with information overlay.
    
    Args:
        frame: Input frame
        bbox: Bounding box (x1, y1, x2, y2)
        color: BGR color tuple
        patient_id: Patient identifier
        triage_status: Triage status
        breathing_rate: Breathing rate
        confidence: Detection confidence
        signal_quality: Signal quality (0-1)
    
    Returns:
        Frame with drawn overlay
    """
    x1, y1, x2, y2 = bbox
    
    # Draw bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
    
    # Draw patient ID
    cv2.putText(frame, patient_id, (x1, y1 - 10), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    
    # Draw triage status
    cv2.putText(frame, triage_status, (x1, y2 + 20), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    
    # Draw vital signs
    if breathing_rate > 0:
        rr_text = f"RR: {breathing_rate:.1f}"
    else:
        rr_text = "RR: Unknown"
    
    cv2.putText(frame, rr_text, (x1, y2 + 40), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
    
    # Draw confidence and signal quality
    conf_text = f"Conf: {confidence:.2f}"
    cv2.putText(frame, conf_text, (x1, y2 + 60), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
    
    if signal_quality > 0:
        sq_text = f"SQ: {signal_quality:.2f}"
        cv2.putText(frame, sq_text, (x1, y2 + 80), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
    
    return frame


def calculate_fps(frame_times: List[float]) -> float:
    """Calculate FPS from frame timestamps."""
    if len(frame_times) < 2:
        return 0.0
    
    time_diffs = [frame_times[i] - frame_times[i-1] for i in range(1, len(frame_times))]
    avg_frame_time = np.mean(time_diffs)
    
    if avg_frame_time > 0:
        return 1.0 / avg_frame_time
    return 0.0


def get_status_indicator(patient_state, triage_decision) -> str:
    """Get status indicator string for display."""
    signal_quality = getattr(patient_state, 'signal_quality', 0.0)
    visibility = patient_state.confidence
    
    if signal_quality < 0.2:
        return "Low signal quality → Unknown"
    elif visibility < 0.3:
        return "Low visibility → Unknown"
    elif triage_decision and triage_decision.final_decision == "UNKNOWN":
        return "Poor detection → Unknown"
    else:
        return "Good signal quality"


def create_patient_summary(patient_state, triage_decision) -> Dict[str, Any]:
    """Create a summary dictionary for a patient."""
    return {
        'patient_id': patient_state.id,
        'timestamp': patient_state.timestamp,
        'breathing_rate': patient_state.breathing_rate,
        'is_breathing': patient_state.is_breathing,
        'is_responsive': patient_state.is_responsive,
        'movement_score': patient_state.movement_score,
        'confidence': patient_state.confidence,
        'signal_quality': getattr(patient_state, 'signal_quality', 0.0),
        'triage_status': triage_decision.final_decision if triage_decision else "UNKNOWN",
        'ai_suggestion': triage_decision.ai_suggestion if triage_decision else "UNKNOWN",
        'reasoning': triage_decision.reasoning if triage_decision else "No analysis available"
    }

"""
Triage Agent for dynamic patient analysis using START triage protocol.
Applies simplified START triage logic and confidence scoring.
Enhanced with audio analysis integration.
"""

import time
from typing import Dict, List, Optional, Tuple
from utils import PatientState, TriageDecision
from audio import AudioAnalysis


class TriageAgent:
    """Dynamic triage analysis agent using START protocol."""
    
    def __init__(self):
        self.patient_history: Dict[str, List[PatientState]] = {}
        self.triage_decisions: Dict[str, TriageDecision] = {}
        self.human_overrides: Dict[str, str] = {}
        
    def analyze_patient(self, patient_state: PatientState, audio_analysis: Optional[AudioAnalysis] = None) -> TriageDecision:
        """
        Analyze patient state and make triage decision with optional audio analysis.
        
        Args:
            patient_state: Current patient state
            audio_analysis: Optional audio analysis results
            
        Returns:
            TriageDecision object
        """
        current_time = time.time()
        
        # Store patient history
        if patient_state.id not in self.patient_history:
            self.patient_history[patient_state.id] = []
        
        self.patient_history[patient_state.id].append(patient_state)
        
        # Keep only last 10 states per patient
        if len(self.patient_history[patient_state.id]) > 10:
            self.patient_history[patient_state.id] = self.patient_history[patient_state.id][-10:]
        
        # Apply START triage logic with audio integration
        ai_suggestion, confidence, reasoning = self._apply_start_triage(patient_state, audio_analysis)
        
        # Check for human override
        human_override = self.human_overrides.get(patient_state.id)
        final_decision = human_override if human_override else ai_suggestion
        
        # Create triage decision
        decision = TriageDecision(
            patient_id=patient_state.id,
            timestamp=current_time,
            ai_suggestion=ai_suggestion,
            confidence=confidence,
            human_override=human_override,
            final_decision=final_decision,
            reasoning=reasoning
        )
        
        self.triage_decisions[patient_state.id] = decision
        return decision
    
    def _apply_start_triage(self, patient_state: PatientState, audio_analysis: Optional[AudioAnalysis] = None) -> Tuple[str, float, str]:
        """
        Apply enhanced START triage logic with audio integration.
        
        START Protocol:
        - RED: No breathing OR RR > 30 OR RR < 10 OR high distress audio
        - YELLOW: Breathing but unresponsive OR moderate distress audio
        - GREEN: Breathing and responsive OR comfort audio
        - BLACK: Deceased (not breathing for extended period)
        - UNKNOWN: Poor signal quality or low visibility
        
        Args:
            patient_state: Patient state to analyze
            audio_analysis: Optional audio analysis results
            
        Returns:
            Tuple of (triage_level, confidence, reasoning)
        """
        # Get patient history for trend analysis
        history = self.patient_history.get(patient_state.id, [])
        
        # Calculate confidence based on signal quality and audio
        confidence = self._calculate_signal_confidence(patient_state, history, audio_analysis)
        
        # Check for poor signal quality or low visibility
        signal_quality = getattr(patient_state, 'signal_quality', 0.0)
        visibility_quality = patient_state.confidence
        
        # If signal quality is too poor, return UNKNOWN (more lenient for video processing)
        if signal_quality < 0.05 or visibility_quality < 0.1:
            return "UNKNOWN", confidence, f"Poor signal quality (SQ: {signal_quality:.2f}, Vis: {visibility_quality:.2f})"
        
        # Apply audio analysis if available
        audio_reasoning = ""
        if audio_analysis and audio_analysis.confidence > 0.3:
            # High distress audio overrides visual assessment
            if audio_analysis.distress_score > 0.7:
                return "RED", confidence, f"High distress audio detected: {', '.join(audio_analysis.keywords_detected)}"
            
            # Moderate distress audio
            elif audio_analysis.distress_score > 0.4:
                audio_reasoning = f"Distress audio: {', '.join(audio_analysis.keywords_detected)}"
            
            # Comfort audio can improve assessment
            elif audio_analysis.comfort_score > 0.5:
                audio_reasoning = f"Comfort audio: {', '.join(audio_analysis.keywords_detected)}"
        
        # Apply START logic
        if not patient_state.is_breathing:
            # Check if this is a sustained lack of breathing
            sustained_no_breathing = self._check_sustained_no_breathing(history)
            
            if sustained_no_breathing:
                reasoning = "No breathing detected for extended period"
                if audio_reasoning:
                    reasoning += f" | {audio_reasoning}"
                return "BLACK", confidence, reasoning
            else:
                reasoning = "No breathing detected"
                if audio_reasoning:
                    reasoning += f" | {audio_reasoning}"
                return "RED", confidence, reasoning
        
        # Check respiratory rate (only if we have a reliable measurement)
        rr = patient_state.breathing_rate
        if rr > 0:  # Only if we have a valid RR measurement
            if rr > 30 or rr < 10:
                reasoning = f"Abnormal respiratory rate: {rr:.1f} bpm"
                if audio_reasoning:
                    reasoning += f" | {audio_reasoning}"
                return "RED", confidence, reasoning
        else:
            # No reliable RR measurement, check if breathing
            if patient_state.is_breathing:
                # Breathing but no reliable RR - could be YELLOW or GREEN
                if not patient_state.is_responsive:
                    reasoning = "Breathing but unresponsive (RR unknown)"
                    if audio_reasoning:
                        reasoning += f" | {audio_reasoning}"
                    return "YELLOW", confidence, reasoning
                else:
                    reasoning = "Breathing and responsive (RR unknown)"
                    if audio_reasoning:
                        reasoning += f" | {audio_reasoning}"
                    return "GREEN", confidence, reasoning
            else:
                reasoning = "Unable to determine breathing status"
                if audio_reasoning:
                    reasoning += f" | {audio_reasoning}"
                return "UNKNOWN", confidence, reasoning
        
        # Check responsiveness
        if not patient_state.is_responsive:
            reasoning = "Breathing but unresponsive"
            if audio_reasoning:
                reasoning += f" | {audio_reasoning}"
            return "YELLOW", confidence, reasoning
        
        # Default to green if breathing and responsive
        reasoning = "Breathing and responsive"
        if audio_reasoning:
            reasoning += f" | {audio_reasoning}"
        return "GREEN", confidence, reasoning
    
    def _calculate_signal_confidence(self, patient_state: PatientState, 
                                   history: List[PatientState], 
                                   audio_analysis: Optional[AudioAnalysis] = None) -> float:
        """
        Calculate enhanced confidence based on signal quality, consistency, and audio.
        
        Args:
            patient_state: Current patient state
            history: Patient history
            audio_analysis: Optional audio analysis results
            
        Returns:
            Confidence score (0-1)
        """
        base_confidence = patient_state.confidence
        signal_quality = getattr(patient_state, 'signal_quality', 0.0)
        
        # Factor in consistency over time
        consistency_score = 1.0
        if len(history) >= 3:
            # Check consistency of breathing detection
            recent_breathing = [state.is_breathing for state in history[-3:]]
            breathing_consistency = sum(recent_breathing) / len(recent_breathing)
            
            # Check consistency of responsiveness
            recent_responsive = [state.is_responsive for state in history[-3:]]
            responsive_consistency = sum(recent_responsive) / len(recent_responsive)
            
            # Penalize inconsistent signals
            consistency_score = (breathing_consistency + responsive_consistency) / 2
        
        # Factor in signal strength and quality
        signal_strength = min(1.0, patient_state.movement_score * 10)
        
        # Factor in audio confidence if available
        audio_confidence = 0.0
        if audio_analysis and audio_analysis.confidence > 0.3:
            audio_confidence = audio_analysis.confidence
        
        # Combine factors with signal quality as primary factor
        final_confidence = (base_confidence * 0.25 + 
                           signal_quality * 0.35 + 
                           consistency_score * 0.2 + 
                           signal_strength * 0.1 +
                           audio_confidence * 0.1)
        
        return max(0.0, min(1.0, final_confidence))
    
    def _check_sustained_no_breathing(self, history: List[PatientState]) -> bool:
        """
        Check if patient has not been breathing for an extended period.
        
        Args:
            history: Patient history
            
        Returns:
            True if sustained no breathing detected
        """
        if len(history) < 5:
            return False
        
        # Check last 5 states for breathing
        recent_states = history[-5:]
        no_breathing_count = sum(1 for state in recent_states if not state.is_breathing)
        
        # If 80% of recent states show no breathing, consider it sustained
        return no_breathing_count >= 4
    
    def set_human_override(self, patient_id: str, override_decision: str):
        """
        Set human override for a patient.
        
        Args:
            patient_id: Patient identifier
            override_decision: Override decision (RED, YELLOW, GREEN, BLACK, UNKNOWN)
        """
        if override_decision in ["RED", "YELLOW", "GREEN", "BLACK", "UNKNOWN"]:
            self.human_overrides[patient_id] = override_decision
        else:
            raise ValueError(f"Invalid override decision: {override_decision}")
    
    def clear_human_override(self, patient_id: str):
        """Clear human override for a patient."""
        if patient_id in self.human_overrides:
            del self.human_overrides[patient_id]
    
    def get_patient_triage_status(self, patient_id: str) -> Optional[TriageDecision]:
        """Get current triage status for a patient."""
        return self.triage_decisions.get(patient_id)
    
    def get_all_triage_status(self) -> Dict[str, TriageDecision]:
        """Get triage status for all patients."""
        return self.triage_decisions.copy()
    
    def get_triage_statistics(self) -> Dict[str, int]:
        """Get triage statistics."""
        stats = {"RED": 0, "YELLOW": 0, "GREEN": 0, "BLACK": 0, "UNKNOWN": 0}
        
        for decision in self.triage_decisions.values():
            final_decision = decision.final_decision or decision.ai_suggestion
            if final_decision in stats:
                stats[final_decision] += 1
        
        return stats
    
    def get_patient_trend(self, patient_id: str) -> Dict[str, List[float]]:
        """
        Get trend data for a patient.
        
        Args:
            patient_id: Patient identifier
            
        Returns:
            Dictionary with trend data
        """
        if patient_id not in self.patient_history:
            return {}
        
        history = self.patient_history[patient_id]
        
        return {
            'breathing_rates': [state.breathing_rate for state in history],
            'confidences': [state.confidence for state in history],
            'movement_scores': [state.movement_score for state in history],
            'timestamps': [state.timestamp for state in history]
        }
    
    def export_triage_data(self) -> List[Dict]:
        """Export triage data for analysis."""
        export_data = []
        
        for patient_id, decision in self.triage_decisions.items():
            export_data.append({
                'patient_id': patient_id,
                'timestamp': decision.timestamp,
                'ai_suggestion': decision.ai_suggestion,
                'confidence': decision.confidence,
                'human_override': decision.human_override,
                'final_decision': decision.final_decision,
                'reasoning': decision.reasoning
            })
        
        return export_data

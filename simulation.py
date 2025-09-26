"""
Simulation Agent for synthetic patient generation.
Creates realistic patient scenarios for testing and demonstration.
"""

import numpy as np
import cv2
import random
import time
from typing import List, Dict, Tuple, Optional
from utils import PatientState


class SimulationAgent:
    """Synthetic patient generator for testing and demonstration."""
    
    def __init__(self, width: int = 640, height: int = 480):
        self.width = width
        self.height = height
        self.patients: Dict[str, Dict] = {}
        self.next_patient_id = 1
        self.scenarios = self._initialize_scenarios()
        
    def _initialize_scenarios(self) -> List[Dict]:
        """Initialize predefined patient scenarios."""
        return [
            {
                'name': 'Healthy Adult',
                'breathing_rate': (12, 20),
                'is_breathing': True,
                'is_responsive': True,
                'movement_score': (0.3, 0.7),
                'confidence': (0.8, 1.0)
            },
            {
                'name': 'Injured but Responsive',
                'breathing_rate': (15, 25),
                'is_breathing': True,
                'is_responsive': True,
                'movement_score': (0.1, 0.4),
                'confidence': (0.6, 0.9)
            },
            {
                'name': 'Unconscious but Breathing',
                'breathing_rate': (8, 15),
                'is_breathing': True,
                'is_responsive': False,
                'movement_score': (0.0, 0.2),
                'confidence': (0.7, 0.9)
            },
            {
                'name': 'Respiratory Distress',
                'breathing_rate': (25, 35),
                'is_breathing': True,
                'is_responsive': True,
                'movement_score': (0.2, 0.6),
                'confidence': (0.6, 0.8)
            },
            {
                'name': 'Severe Respiratory Distress',
                'breathing_rate': (35, 45),
                'is_breathing': True,
                'is_responsive': False,
                'movement_score': (0.0, 0.3),
                'confidence': (0.5, 0.7)
            },
            {
                'name': 'No Breathing',
                'breathing_rate': (0, 2),
                'is_breathing': False,
                'is_responsive': False,
                'movement_score': (0.0, 0.1),
                'confidence': (0.8, 1.0)
            },
            {
                'name': 'Deceased',
                'breathing_rate': 0,
                'is_breathing': False,
                'is_responsive': False,
                'movement_score': 0.0,
                'confidence': (0.9, 1.0)
            }
        ]
    
    def generate_synthetic_frame(self, num_patients: int = 1) -> Tuple[np.ndarray, List[PatientState]]:
        """
        Generate a synthetic frame with simulated patients.
        
        Args:
            num_patients: Number of patients to simulate
            
        Returns:
            Tuple of (synthetic_frame, patient_states)
        """
        # Create base frame
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        frame.fill(50)  # Dark background
        
        patient_states = []
        
        for i in range(num_patients):
            # Select random scenario
            scenario = random.choice(self.scenarios)
            
            # Generate patient
            patient_id = f"sim_patient_{self.next_patient_id}"
            self.next_patient_id += 1
            
            # Create patient state
            patient_state = self._generate_patient_state(patient_id, scenario)
            patient_states.append(patient_state)
            
            # Draw patient on frame
            self._draw_patient_on_frame(frame, patient_state, scenario)
            
            # Update patient tracking
            self.patients[patient_id] = {
                'scenario': scenario,
                'start_time': time.time(),
                'state': patient_state
            }
        
        return frame, patient_states
    
    def generate_realistic_scenario(self, num_patients: int = 3) -> Tuple[np.ndarray, List[PatientState]]:
        """
        Generate a realistic disaster scenario with mixed patient types.
        
        Args:
            num_patients: Number of patients to simulate
            
        Returns:
            Tuple of (synthetic_frame, patient_states)
        """
        # Create base frame
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        frame.fill(50)  # Dark background
        
        patient_states = []
        
        # Realistic disaster distribution
        scenario_weights = {
            'Healthy Adult': 0.2,
            'Injured but Responsive': 0.3,
            'Unconscious but Breathing': 0.2,
            'Respiratory Distress': 0.15,
            'Severe Respiratory Distress': 0.1,
            'No Breathing': 0.03,
            'Deceased': 0.02
        }
        
        for i in range(num_patients):
            # Select scenario based on weights
            scenario_name = np.random.choice(
                list(scenario_weights.keys()),
                p=list(scenario_weights.values())
            )
            
            scenario = next(s for s in self.scenarios if s['name'] == scenario_name)
            
            # Generate patient
            patient_id = f"disaster_patient_{i+1}"
            
            # Create patient state
            patient_state = self._generate_patient_state(patient_id, scenario)
            patient_states.append(patient_state)
            
            # Draw patient on frame
            self._draw_patient_on_frame(frame, patient_state, scenario)
            
            # Update patient tracking
            self.patients[patient_id] = {
                'scenario': scenario,
                'start_time': time.time(),
                'state': patient_state
            }
        
        return frame, patient_states
    
    def _generate_patient_state(self, patient_id: str, scenario: Dict) -> PatientState:
        """Generate a patient state based on scenario with realistic signal quality."""
        current_time = time.time()
        
        # Generate random position
        x1 = random.randint(50, self.width - 200)
        y1 = random.randint(50, self.height - 200)
        x2 = x1 + random.randint(100, 150)
        y2 = y1 + random.randint(150, 200)
        bbox = (x1, y1, x2, y2)
        
        # Generate breathing rate
        if isinstance(scenario['breathing_rate'], tuple):
            breathing_rate = random.uniform(*scenario['breathing_rate'])
        else:
            breathing_rate = scenario['breathing_rate']
        
        # Generate movement score
        if isinstance(scenario['movement_score'], tuple):
            movement_score = random.uniform(*scenario['movement_score'])
        else:
            movement_score = scenario['movement_score']
        
        # Generate confidence (ensure good visibility for simulation)
        if isinstance(scenario['confidence'], tuple):
            confidence = random.uniform(*scenario['confidence'])
        else:
            confidence = scenario['confidence']
        
        # Ensure confidence is high enough to avoid UNKNOWN status
        confidence = max(0.5, confidence)
        
        # Create patient state
        patient_state = PatientState(
            id=patient_id,
            timestamp=current_time,
            breathing_rate=breathing_rate,
            is_breathing=scenario['is_breathing'],
            is_responsive=scenario['is_responsive'],
            movement_score=movement_score,
            confidence=confidence,
            bounding_box=bbox,
            position=((x1 + x2) // 2, (y1 + y2) // 2)
        )
        
        # Add realistic signal quality based on scenario
        if scenario['name'] == 'Healthy Adult':
            signal_quality = random.uniform(0.7, 0.9)
        elif scenario['name'] == 'Injured but Responsive':
            signal_quality = random.uniform(0.5, 0.8)
        elif scenario['name'] == 'Unconscious but Breathing':
            signal_quality = random.uniform(0.4, 0.7)
        elif scenario['name'] == 'Respiratory Distress':
            signal_quality = random.uniform(0.6, 0.8)
        elif scenario['name'] == 'Severe Respiratory Distress':
            signal_quality = random.uniform(0.3, 0.6)
        elif scenario['name'] == 'No Breathing':
            signal_quality = random.uniform(0.2, 0.5)
        elif scenario['name'] == 'Deceased':
            signal_quality = random.uniform(0.1, 0.3)
        else:
            signal_quality = random.uniform(0.4, 0.8)
        
        # Add signal quality as attribute
        patient_state.signal_quality = signal_quality
        
        return patient_state
    
    def _draw_patient_on_frame(self, frame: np.ndarray, patient_state: PatientState, 
                             scenario: Dict):
        """Draw patient representation on frame."""
        x1, y1, x2, y2 = patient_state.bounding_box
        
        # Draw bounding box
        color = self._get_patient_color(patient_state)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        
        # Draw patient ID
        cv2.putText(frame, patient_state.id, (x1, y1 - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        
        # Draw vital signs
        info_text = f"RR: {patient_state.breathing_rate:.1f}"
        cv2.putText(frame, info_text, (x1, y2 + 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        
        # Draw status indicators
        status_text = "Breathing" if patient_state.is_breathing else "No Breathing"
        cv2.putText(frame, status_text, (x1, y2 + 40), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        
        responsive_text = "Responsive" if patient_state.is_responsive else "Unresponsive"
        cv2.putText(frame, responsive_text, (x1, y2 + 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        
        # Draw confidence
        conf_text = f"Conf: {patient_state.confidence:.2f}"
        cv2.putText(frame, conf_text, (x1, y2 + 80), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
    
    def _get_patient_color(self, patient_state: PatientState) -> Tuple[int, int, int]:
        """Get color based on patient state."""
        if not patient_state.is_breathing:
            return (0, 0, 255)  # Red for no breathing
        elif patient_state.breathing_rate > 30 or patient_state.breathing_rate < 10:
            return (0, 0, 255)  # Red for abnormal RR
        elif not patient_state.is_responsive:
            return (0, 255, 255)  # Yellow for unresponsive
        else:
            return (0, 255, 0)  # Green for normal
    
    def update_patient_scenario(self, patient_id: str, new_scenario: str):
        """
        Update a patient's scenario.
        
        Args:
            patient_id: Patient identifier
            new_scenario: New scenario name
        """
        scenario = next((s for s in self.scenarios if s['name'] == new_scenario), None)
        if scenario and patient_id in self.patients:
            self.patients[patient_id]['scenario'] = scenario
    
    def get_available_scenarios(self) -> List[str]:
        """Get list of available scenarios."""
        return [scenario['name'] for scenario in self.scenarios]
    
    def create_disaster_scenario(self, num_patients: int = 5) -> List[PatientState]:
        """
        Create a realistic disaster scenario with multiple patients.
        
        Args:
            num_patients: Number of patients in scenario
            
        Returns:
            List of PatientState objects
        """
        # Realistic disaster distribution
        scenario_weights = {
            'Healthy Adult': 0.1,
            'Injured but Responsive': 0.3,
            'Unconscious but Breathing': 0.2,
            'Respiratory Distress': 0.15,
            'Severe Respiratory Distress': 0.15,
            'No Breathing': 0.05,
            'Deceased': 0.05
        }
        
        patient_states = []
        
        for i in range(num_patients):
            # Select scenario based on weights
            scenario_name = np.random.choice(
                list(scenario_weights.keys()),
                p=list(scenario_weights.values())
            )
            
            scenario = next(s for s in self.scenarios if s['name'] == scenario_name)
            patient_id = f"disaster_patient_{i+1}"
            
            patient_state = self._generate_patient_state(patient_id, scenario)
            patient_states.append(patient_state)
        
        return patient_states
    
    def generate_breathing_animation(self, patient_id: str, duration: float = 10.0) -> List[PatientState]:
        """
        Generate breathing animation for a patient.
        
        Args:
            patient_id: Patient identifier
            duration: Animation duration in seconds
            
        Returns:
            List of PatientState objects over time
        """
        states = []
        fps = 30
        total_frames = int(duration * fps)
        
        for frame in range(total_frames):
            t = frame / fps
            
            # Simulate breathing cycle
            breathing_cycle = np.sin(2 * np.pi * t * 0.2)  # 12 breaths per minute
            
            # Create patient state
            patient_state = PatientState(
                id=patient_id,
                timestamp=time.time() + t,
                breathing_rate=12 + breathing_cycle * 2,
                is_breathing=True,
                is_responsive=True,
                movement_score=0.3 + abs(breathing_cycle) * 0.2,
                confidence=0.8 + breathing_cycle * 0.1,
                bounding_box=(100, 100, 200, 300),
                position=(150, 200)
            )
            
            states.append(patient_state)
        
        return states
    
    def export_scenario_data(self) -> Dict:
        """Export scenario data for analysis."""
        return {
            'scenarios': self.scenarios,
            'active_patients': len(self.patients),
            'patient_data': {
                pid: {
                    'scenario': data['scenario']['name'],
                    'start_time': data['start_time']
                }
                for pid, data in self.patients.items()
            }
        }

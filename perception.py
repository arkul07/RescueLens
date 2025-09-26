"""
Perception Agent for multimodal patient state detection.
Handles person detection, breathing analysis, and responsiveness detection.
"""

import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional
import time
from utils import PatientState, calculate_optical_flow_magnitude, estimate_breathing_rate, calculate_movement_score

# Enhanced simplified pose detection for real video
class SimplePose:
    def __init__(self):
        self.pose_landmarks = None
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.body_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_fullbody.xml')
    
    def process(self, image):
        # Use OpenCV for basic person detection with improved sensitivity
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect faces and bodies with more sensitive parameters
        faces = self.face_cascade.detectMultiScale(gray, 1.05, 3, minSize=(30, 30))
        bodies = self.body_cascade.detectMultiScale(gray, 1.05, 3, minSize=(50, 100))
        
        # Also try profile face detection for better coverage
        profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        profile_faces = profile_cascade.detectMultiScale(gray, 1.05, 3, minSize=(30, 30))
        
        # Combine all detections
        all_detections = []
        if len(faces) > 0:
            all_detections.extend([(x, y, w, h, 'face') for x, y, w, h in faces])
        if len(bodies) > 0:
            all_detections.extend([(x, y, w, h, 'body') for x, y, w, h in bodies])
        if len(profile_faces) > 0:
            all_detections.extend([(x, y, w, h, 'profile') for x, y, w, h in profile_faces])
        
        # Create mock landmarks based on detected faces/bodies
        if len(all_detections) > 0:
            # Use the largest detection
            largest_detection = max(all_detections, key=lambda det: det[2] * det[3])
            x, y, w, h, det_type = largest_detection
            
            # Adjust bounding box based on detection type
            if det_type == 'face':
                # Scale up face to approximate body
                h = int(h * 3)  # Make it taller for body
                y = max(0, y - h//3)  # Move up
            elif det_type == 'profile':
                # Scale up profile face
                h = int(h * 2.5)
                y = max(0, y - h//4)
            
            # Create mock landmarks based on detection
            landmarks = []
            for i in range(33):
                landmark = MockLandmark()
                
                # Distribute landmarks across the detected area
                if i < 11:  # Face landmarks
                    landmark.x = (x + w * (0.3 + 0.4 * (i % 3) / 3)) / image.shape[1]
                    landmark.y = (y + h * (0.1 + 0.3 * (i // 3) / 3)) / image.shape[0]
                    landmark.visibility = 0.9
                elif i < 17:  # Upper body
                    landmark.x = (x + w * (0.2 + 0.6 * (i - 11) / 5)) / image.shape[1]
                    landmark.y = (y + h * (0.3 + 0.4 * (i - 11) / 5)) / image.shape[0]
                    landmark.visibility = 0.8
                else:  # Lower body
                    landmark.x = (x + w * (0.3 + 0.4 * (i - 17) / 15)) / image.shape[1]
                    landmark.y = (y + h * (0.6 + 0.3 * (i - 17) / 15)) / image.shape[0]
                    landmark.visibility = 0.7
                
                landmarks.append(landmark)
            
            class MockLandmarks:
                def __init__(self, landmarks):
                    self.landmark = landmarks
            
            self.pose_landmarks = MockLandmarks(landmarks)
        else:
            # No detection - return None
            self.pose_landmarks = None
        
        return self

class MockLandmark:
    def __init__(self):
        self.x = 0.5
        self.y = 0.5
        self.visibility = 0.8

class SimpleDrawing:
    @staticmethod
    def draw_landmarks(image, landmarks, connections):
        # Simplified drawing - just return the image
        return image


class PerceptionAgent:
    """Multimodal perception agent for patient state detection."""
    
    def __init__(self):
        # Initialize simplified pose detection
        self.mp_pose = SimplePose()
        self.mp_drawing = SimpleDrawing()
        self.pose = SimplePose()
        
        # Patient tracking
        self.patients: Dict[str, Dict] = {}
        self.next_patient_id = 1
        
        # Breathing analysis buffers
        self.breathing_buffers: Dict[str, List[float]] = {}
        self.frame_history: List[np.ndarray] = []
        self.max_history = 30  # Keep last 30 frames for analysis
        
        # Audio analysis (stub)
        self.audio_buffer: List[float] = []
        
    def process_frame(self, frame: np.ndarray, fps: float = 30) -> List[PatientState]:
        """
        Process a single frame and return patient states.
        
        Args:
            frame: Input video frame
            fps: Frames per second
            
        Returns:
            List of PatientState objects
        """
        current_time = time.time()
        
        # Store frame for breathing analysis
        self.frame_history.append(frame.copy())
        if len(self.frame_history) > self.max_history:
            self.frame_history.pop(0)
        
        # Convert BGR to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Detect poses
        results = self.pose.process(rgb_frame)
        
        patient_states = []
        
        if results.pose_landmarks:
            # For simplicity, treat each pose as a separate patient
            # In a real system, you'd track individuals across frames
            patient_id = f"patient_{self.next_patient_id}"
            self.next_patient_id += 1
            
            # Extract pose landmarks
            landmarks = results.pose_landmarks.landmark
            
            # Calculate bounding box from pose landmarks
            bbox = self._calculate_pose_bbox(landmarks, frame.shape)
            
            # Analyze breathing
            breathing_rate, is_breathing, signal_quality = self._analyze_breathing(
                patient_id, frame, bbox, fps
            )
            
            # Analyze responsiveness
            is_responsive, movement_score = self._analyze_responsiveness(
                patient_id, landmarks
            )
            
            # Calculate confidence based on pose visibility
            confidence = self._calculate_confidence(landmarks)
            
            # Create patient state
            patient_state = PatientState(
                id=patient_id,
                timestamp=current_time,
                breathing_rate=breathing_rate,
                is_breathing=is_breathing,
                is_responsive=is_responsive,
                movement_score=movement_score,
                confidence=confidence,
                bounding_box=bbox,
                position=self._get_center_position(bbox)
            )
            
            # Add signal quality as an attribute
            patient_state.signal_quality = signal_quality
            
            patient_states.append(patient_state)
            
            # Update patient tracking
            self.patients[patient_id] = {
                'last_seen': current_time,
                'landmarks': landmarks,
                'state': patient_state
            }
        
        # Fallback: Create a mock patient for testing if no detection
        if len(patient_states) == 0 and len(self.patients) == 0:
            patient_id = "mock_patient_1"
            
            # Create a mock bounding box in the center of the frame
            h, w = frame.shape[:2]
            bbox = (w//4, h//4, 3*w//4, 3*h//4)  # Center 50% of frame
            
            # Analyze breathing with mock data
            breathing_rate, is_breathing, signal_quality = self._analyze_breathing(
                patient_id, frame, bbox, fps
            )
            
            # Create mock patient state
            patient_state = PatientState(
                id=patient_id,
                timestamp=current_time,
                breathing_rate=breathing_rate,
                is_breathing=is_breathing,
                is_responsive=True,  # Assume responsive for mock
                movement_score=0.5,  # Moderate movement
                confidence=0.6,  # Moderate confidence
                bounding_box=bbox,
                position=self._get_center_position(bbox)
            )
            
            # Add signal quality
            patient_state.signal_quality = signal_quality
            
            patient_states.append(patient_state)
            
            # Update patient tracking
            self.patients[patient_id] = {
                'last_seen': current_time,
                'landmarks': [],
                'state': patient_state
            }
        
        # Clean up old patients (not seen for 5 seconds)
        self._cleanup_old_patients(current_time)
        
        return patient_states
    
    def _calculate_pose_bbox(self, landmarks, frame_shape) -> Tuple[int, int, int, int]:
        """Calculate bounding box from pose landmarks."""
        h, w = frame_shape[:2]
        
        # Get visible landmarks
        visible_landmarks = [
            (int(lm.x * w), int(lm.y * h)) 
            for lm in landmarks 
            if lm.visibility > 0.5
        ]
        
        if not visible_landmarks:
            return (0, 0, w, h)
        
        x_coords = [pt[0] for pt in visible_landmarks]
        y_coords = [pt[1] for pt in visible_landmarks]
        
        x1 = max(0, min(x_coords) - 20)
        y1 = max(0, min(y_coords) - 20)
        x2 = min(w, max(x_coords) + 20)
        y2 = min(h, max(y_coords) + 20)
        
        return (x1, y1, x2, y2)
    
    def _analyze_breathing(self, patient_id: str, frame: np.ndarray, 
                         bbox: Tuple[int, int, int, int], fps: float) -> Tuple[float, bool, float]:
        """
        Analyze breathing by looking at chest region motion with improved signal quality assessment.
        
        Args:
            patient_id: Patient identifier
            frame: Current frame
            bbox: Bounding box (x1, y1, x2, y2)
            fps: Frames per second
            
        Returns:
            Tuple of (breathing_rate, is_breathing, signal_quality)
        """
        x1, y1, x2, y2 = bbox
        
        # Focus on upper chest region (roughly upper 1/3 of bounding box)
        chest_height = (y2 - y1) // 3
        chest_bbox = (x1, y1, x2, y1 + chest_height)
        
        # Calculate optical flow magnitude in chest region
        if len(self.frame_history) >= 2:
            prev_frame = self.frame_history[-2]
            flow_magnitude = calculate_optical_flow_magnitude(
                prev_frame, frame, chest_bbox
            )
        else:
            flow_magnitude = 0.0
        
        # Update breathing buffer
        if patient_id not in self.breathing_buffers:
            self.breathing_buffers[patient_id] = []
        
        self.breathing_buffers[patient_id].append(flow_magnitude)
        
        # Keep only last 5 seconds of data for better analysis
        max_buffer_size = int(fps * 5)
        if len(self.breathing_buffers[patient_id]) > max_buffer_size:
            self.breathing_buffers[patient_id] = self.breathing_buffers[patient_id][-max_buffer_size:]
        
        # Calculate signal quality
        signal_quality = self._calculate_breathing_signal_quality(patient_id)
        
        # Estimate breathing rate with quality check
        if len(self.breathing_buffers[patient_id]) >= 15 and signal_quality > 0.3:
            breathing_rate = estimate_breathing_rate(
                self.breathing_buffers[patient_id], fps
            )
            # Clamp to reasonable range
            breathing_rate = max(0, min(60, breathing_rate))
        else:
            breathing_rate = 0.0  # Unknown BPM due to poor signal
        
        # Determine if breathing with adaptive threshold
        recent_magnitudes = self.breathing_buffers[patient_id][-10:]
        if recent_magnitudes:
            avg_magnitude = np.mean(recent_magnitudes)
            std_magnitude = np.std(recent_magnitudes)
            
            # Adaptive threshold based on signal quality
            threshold = 3.0 + (1.0 - signal_quality) * 5.0
            is_breathing = avg_magnitude > threshold and std_magnitude > 1.0
        else:
            is_breathing = False
        
        return breathing_rate, is_breathing, signal_quality
    
    def _calculate_breathing_signal_quality(self, patient_id: str) -> float:
        """Calculate signal quality for breathing analysis."""
        if patient_id not in self.breathing_buffers or len(self.breathing_buffers[patient_id]) < 10:
            return 0.0
        
        magnitudes = np.array(self.breathing_buffers[patient_id])
        
        # Signal quality based on:
        # 1. Consistency of signal
        # 2. Presence of periodic patterns
        # 3. Signal-to-noise ratio
        
        # Check for periodic patterns (breathing cycles)
        if len(magnitudes) >= 20:
            # Simple peak detection for breathing cycles
            from scipy.signal import find_peaks
            peaks, _ = find_peaks(magnitudes, height=np.mean(magnitudes))
            
            # Quality based on number of detected peaks
            cycle_quality = min(1.0, len(peaks) / 5.0)  # Expect ~5 cycles in 5 seconds
        else:
            cycle_quality = 0.0
        
        # Signal consistency
        consistency = 1.0 - (np.std(magnitudes) / (np.mean(magnitudes) + 1e-6))
        consistency = max(0.0, min(1.0, consistency))
        
        # Overall signal strength
        strength = min(1.0, np.mean(magnitudes) / 10.0)
        
        # Combine factors
        signal_quality = (cycle_quality * 0.4 + consistency * 0.3 + strength * 0.3)
        return max(0.0, min(1.0, signal_quality))
    
    def _analyze_responsiveness(self, patient_id: str, landmarks) -> Tuple[bool, float]:
        """
        Analyze patient responsiveness based on movement patterns.
        
        Args:
            patient_id: Patient identifier
            landmarks: Current pose landmarks
            
        Returns:
            Tuple of (is_responsive, movement_score)
        """
        # Get previous landmarks for comparison
        if patient_id in self.patients:
            prev_landmarks = self.patients[patient_id].get('landmarks', [])
            if prev_landmarks:
                movement_score = calculate_movement_score(landmarks, prev_landmarks)
            else:
                movement_score = 0.0
        else:
            movement_score = 0.0
        
        # Simple responsiveness heuristic:
        # - High movement in arms/head suggests responsiveness
        # - Low movement suggests unresponsive
        arm_landmarks = [11, 12, 13, 14, 15, 16]  # Shoulder, elbow, wrist
        head_landmarks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]  # Face landmarks
        
        arm_movement = 0.0
        head_movement = 0.0
        
        for i in arm_landmarks:
            if i < len(landmarks) and landmarks[i].visibility > 0.5:
                arm_movement += 1.0
        
        for i in head_landmarks:
            if i < len(landmarks) and landmarks[i].visibility > 0.5:
                head_movement += 1.0
        
        # Responsiveness based on movement and landmark visibility
        is_responsive = (movement_score > 0.1 and 
                        (arm_movement > 2 or head_movement > 5))
        
        return is_responsive, movement_score
    
    def _calculate_confidence(self, landmarks) -> float:
        """Calculate confidence based on pose landmark visibility."""
        if not landmarks:
            return 0.0
        
        # Average visibility of key landmarks
        key_landmarks = [0, 11, 12, 23, 24]  # Nose, shoulders, hips
        visibilities = [landmarks[i].visibility for i in key_landmarks 
                       if i < len(landmarks)]
        
        if not visibilities:
            return 0.0
        
        return np.mean(visibilities)
    
    def _get_center_position(self, bbox: Tuple[int, int, int, int]) -> Tuple[int, int]:
        """Get center position of bounding box."""
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) // 2, (y1 + y2) // 2)
    
    def _cleanup_old_patients(self, current_time: float):
        """Remove patients not seen for 5 seconds."""
        timeout = 5.0
        to_remove = []
        
        for patient_id, data in self.patients.items():
            if current_time - data['last_seen'] > timeout:
                to_remove.append(patient_id)
                # Clean up breathing buffer
                if patient_id in self.breathing_buffers:
                    del self.breathing_buffers[patient_id]
        
        for patient_id in to_remove:
            del self.patients[patient_id]
    
    def detect_audio_distress(self, audio_data: np.ndarray) -> Dict[str, float]:
        """
        Stub function for audio distress detection.
        
        Args:
            audio_data: Audio samples
            
        Returns:
            Dictionary with distress indicators and confidence
        """
        # This is a stub implementation
        # In a real system, you would:
        # 1. Apply audio preprocessing (noise reduction, normalization)
        # 2. Extract audio features (MFCC, spectral features)
        # 3. Use ML model to detect distress cues
        # 4. Look for keywords like "help", "pain", distress sounds
        
        return {
            'distress_detected': False,
            'confidence': 0.0,
            'keywords_found': [],
            'audio_quality': 0.0
        }
    
    def get_patient_summary(self) -> Dict[str, Dict]:
        """Get summary of all tracked patients."""
        summary = {}
        for patient_id, data in self.patients.items():
            if 'state' in data:
                state = data['state']
                summary[patient_id] = {
                    'breathing_rate': state.breathing_rate,
                    'is_breathing': state.is_breathing,
                    'is_responsive': state.is_responsive,
                    'confidence': state.confidence,
                    'last_seen': data['last_seen']
                }
        return summary

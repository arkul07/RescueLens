"""
Audio Agent for RescueLens - Real-time audio analysis for triage decisions.

This module handles:
- Microphone access and audio capture
- Speech recognition and keyword analysis
- Distress/comfort cue detection
- Voice quality assessment
"""

import speech_recognition as sr
import pyaudio
import numpy as np
import threading
import time
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import deque


@dataclass
class AudioAnalysis:
    """Audio analysis results."""
    keywords_detected: List[str]
    distress_score: float  # 0.0 (no distress) to 1.0 (high distress)
    comfort_score: float  # 0.0 (no comfort) to 1.0 (high comfort)
    voice_quality: float   # 0.0 (poor) to 1.0 (excellent)
    confidence: float      # Overall confidence in analysis
    is_speaking: bool      # Whether someone is currently speaking
    audio_level: float     # Current audio level (0.0 to 1.0)


class AudioAgent:
    """Real-time audio analysis for triage decisions."""
    
    def __init__(self, sample_rate: int = 16000, chunk_size: int = 1024):
        """
        Initialize the audio agent.
        
        Args:
            sample_rate: Audio sample rate in Hz
            chunk_size: Audio chunk size for processing
        """
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # Audio processing
        self.audio_buffer = deque(maxlen=50)  # Keep last 50 chunks
        self.is_listening = False
        self.audio_thread = None
        self.stop_audio = False
        
        # Keyword patterns for distress and comfort
        self.distress_keywords = [
            r'\bhelp\b', r'\bpain\b', r'\bhurt\b', r'\bdying\b', r'\bdying\b',
            r'\bcan\'t breathe\b', r'\bcant breathe\b', r'\bcan\'t breath\b',
            r'\bemergency\b', r'\bambulance\b', r'\bdoctor\b', r'\bmedic\b',
            r'\bbleeding\b', r'\binjured\b', r'\bwounded\b', r'\bunconscious\b',
            r'\bpassing out\b', r'\bblacking out\b', r'\bchest pain\b',
            r'\bheart attack\b', r'\bstroke\b', r'\bseizure\b'
        ]
        
        self.comfort_keywords = [
            r'\bim ok\b', r'\bi\'m ok\b', r'\bim fine\b', r'\bi\'m fine\b',
            r'\bdoing well\b', r'\bfeeling better\b', r'\bno problem\b',
            r'\bno issues\b', r'\bgood\b', r'\bfine\b', r'\bokay\b',
            r'\bno pain\b', r'\bno hurt\b', r'\bcomfortable\b',
            r'\bstable\b', r'\bnormal\b', r'\bhealthy\b'
        ]
        
        # Compile regex patterns for efficiency
        self.distress_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.distress_keywords]
        self.comfort_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.comfort_keywords]
        
        # Audio level thresholds
        self.silence_threshold = 0.01
        self.speaking_threshold = 0.05
        
        print("🎤 Audio Agent initialized")
    
    def start_listening(self) -> bool:
        """Start continuous audio listening."""
        try:
            if self.is_listening:
                return True
            
            self.is_listening = True
            self.stop_audio = False
            
            # Start audio processing thread
            self.audio_thread = threading.Thread(target=self._audio_processing_loop, daemon=True)
            self.audio_thread.start()
            
            print("🎤 Audio listening started")
            return True
            
        except Exception as e:
            print(f"❌ Error starting audio listening: {e}")
            return False
    
    def stop_listening(self):
        """Stop audio listening."""
        self.stop_audio = True
        self.is_listening = False
        
        if self.audio_thread and self.audio_thread.is_alive():
            self.audio_thread.join(timeout=2.0)
        
        print("🎤 Audio listening stopped")
    
    def _audio_processing_loop(self):
        """Continuous audio processing loop."""
        try:
            with self.microphone as source:
                # Adjust for ambient noise
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
                
                while not self.stop_audio and self.is_listening:
                    try:
                        # Listen for audio with timeout
                        audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=5)
                        
                        # Process the audio
                        self._process_audio_chunk(audio)
                        
                    except sr.WaitTimeoutError:
                        # No speech detected, continue listening
                        continue
                    except Exception as e:
                        print(f"⚠️ Audio processing error: {e}")
                        time.sleep(0.1)
                        
        except Exception as e:
            print(f"❌ Audio processing loop error: {e}")
    
    def _process_audio_chunk(self, audio):
        """Process a single audio chunk."""
        try:
            # Convert to text
            text = self.recognizer.recognize_google(audio)
            if not text:
                return
            
            # Store in buffer
            self.audio_buffer.append({
                'text': text,
                'timestamp': time.time()
            })
            
            print(f"🎤 Heard: {text}")
            
        except sr.UnknownValueError:
            # Speech not understood
            pass
        except sr.RequestError as e:
            print(f"⚠️ Speech recognition error: {e}")
    
    def analyze_audio(self) -> AudioAnalysis:
        """
        Analyze recent audio for distress/comfort cues.
        
        Returns:
            AudioAnalysis object with analysis results
        """
        try:
            # Get recent audio from buffer
            recent_audio = list(self.audio_buffer)[-10:]  # Last 10 chunks
            
            if not recent_audio:
                return AudioAnalysis(
                    keywords_detected=[],
                    distress_score=0.0,
                    comfort_score=0.0,
                    voice_quality=0.0,
                    confidence=0.0,
                    is_speaking=False,
                    audio_level=0.0
                )
            
            # Combine recent text
            combined_text = " ".join([chunk['text'] for chunk in recent_audio])
            
            # Analyze for keywords
            distress_matches = self._find_keyword_matches(combined_text, self.distress_patterns)
            comfort_matches = self._find_keyword_matches(combined_text, self.comfort_patterns)
            
            # Calculate scores
            distress_score = min(len(distress_matches) * 0.3, 1.0)
            comfort_score = min(len(comfort_matches) * 0.3, 1.0)
            
            # Determine if someone is speaking
            is_speaking = len(combined_text.strip()) > 0
            
            # Calculate confidence based on text clarity and keyword matches
            confidence = min(len(combined_text) / 50.0, 1.0) if combined_text else 0.0
            
            # Estimate voice quality (simplified)
            voice_quality = min(confidence * 1.2, 1.0)
            
            # Calculate audio level (simplified)
            audio_level = min(len(combined_text) / 100.0, 1.0)
            
            return AudioAnalysis(
                keywords_detected=distress_matches + comfort_matches,
                distress_score=distress_score,
                comfort_score=comfort_score,
                voice_quality=voice_quality,
                confidence=confidence,
                is_speaking=is_speaking,
                audio_level=audio_level
            )
            
        except Exception as e:
            print(f"❌ Audio analysis error: {e}")
            return AudioAnalysis(
                keywords_detected=[],
                distress_score=0.0,
                comfort_score=0.0,
                voice_quality=0.0,
                confidence=0.0,
                is_speaking=False,
                audio_level=0.0
            )
    
    def _find_keyword_matches(self, text: str, patterns: List[re.Pattern]) -> List[str]:
        """Find keyword matches in text."""
        matches = []
        for pattern in patterns:
            if pattern.search(text):
                matches.append(pattern.pattern)
        return matches
    
    def get_audio_status(self) -> Dict:
        """Get current audio system status."""
        return {
            'is_listening': self.is_listening,
            'buffer_size': len(self.audio_buffer),
            'recent_text': list(self.audio_buffer)[-3:] if self.audio_buffer else [],
            'microphone_available': self.microphone is not None
        }


# Test function
def test_audio_agent():
    """Test the audio agent functionality."""
    print("🧪 Testing Audio Agent...")
    
    agent = AudioAgent()
    
    try:
        # Start listening
        if agent.start_listening():
            print("✅ Audio listening started")
            
            # Test for 10 seconds
            for i in range(10):
                time.sleep(1)
                analysis = agent.analyze_audio()
                print(f"Analysis {i+1}: Distress={analysis.distress_score:.2f}, "
                      f"Comfort={analysis.comfort_score:.2f}, "
                      f"Keywords={analysis.keywords_detected}")
            
            # Stop listening
            agent.stop_listening()
            print("✅ Audio listening stopped")
            
        else:
            print("❌ Failed to start audio listening")
            
    except Exception as e:
        print(f"❌ Audio test error: {e}")


if __name__ == "__main__":
    test_audio_agent()


"""
Simulation agent for testing the triage system.
Generates synthetic patient states to stress-test the pipeline.
"""

import asyncio
import json
import random
import time
import websockets
from typing import Dict, Any


class SimulationAgent:
    """Generates synthetic patient states for testing."""
    
    def __init__(self, websocket_url: str = "ws://localhost:8000/ws"):
        self.websocket_url = websocket_url
        self.patient_counter = 0
        self.running = False
    
    async def generate_patient_state(self) -> Dict[str, Any]:
        """Generate a synthetic patient state."""
        self.patient_counter += 1
        current_time = int(time.time() * 1000)
        
        # Random patient characteristics
        breathing = random.choice([True, False, None])
        movement = random.choice(["purposeful", "low", "none", "unknown"])
        
        # Generate RR based on breathing status
        rr_bpm = None
        if breathing is True:
            rr_bpm = random.uniform(12, 30)  # Normal to slightly elevated
        elif breathing is False:
            rr_bpm = 0
        else:
            rr_bpm = random.uniform(8, 35)  # Wide range for unknown
        
        # Generate bounding box (normalized coordinates)
        bbox = {
            "x": random.uniform(0.1, 0.7),
            "y": random.uniform(0.1, 0.7),
            "w": random.uniform(0.2, 0.4),
            "h": random.uniform(0.3, 0.6)
        }
        
        # Generate audio data (optional)
        audio = None
        if random.random() < 0.3:  # 30% chance of audio data
            audio = {
                "distressKeyword": random.choice(["help", "cant_breathe", "im_ok", None]),
                "breathingPresent": random.choice([True, False, None]),
                "snr": random.uniform(0.1, 10.0)
            }
        
        return {
            "id": f"sim_patient_{self.patient_counter}",
            "bbox": bbox,
            "rr_bpm": rr_bpm,
            "breathing": breathing,
            "movement": movement,
            "audio": audio,
            "signal_q": random.uniform(0.3, 1.0),
            "det_conf": random.uniform(0.4, 1.0),
            "ts": current_time
        }
    
    async def send_patient_state(self, websocket, patient_state: Dict[str, Any]):
        """Send patient state to WebSocket."""
        message = {
            "type": "patient_state",
            "data": patient_state
        }
        
        await websocket.send(json.dumps(message))
        print(f"📤 Sent patient state: {patient_state['id']} - {patient_state['movement']} - RR: {patient_state['rr_bpm']}")
    
    async def run_simulation(self, duration_seconds: int = 300, interval_seconds: float = 2.0):
        """Run the simulation for specified duration."""
        print(f"🎭 Starting simulation for {duration_seconds} seconds...")
        self.running = True
        start_time = time.time()
        
        try:
            async with websockets.connect(self.websocket_url) as websocket:
                print("🔗 Connected to WebSocket")
                
                while self.running and (time.time() - start_time) < duration_seconds:
                    # Generate and send patient state
                    patient_state = await self.generate_patient_state()
                    await self.send_patient_state(websocket, patient_state)
                    
                    # Wait for interval
                    await asyncio.sleep(interval_seconds)
                    
                    # Occasionally add/remove patients
                    if random.random() < 0.1:  # 10% chance
                        if random.random() < 0.5:
                            # Add another patient
                            patient_state = await self.generate_patient_state()
                            await self.send_patient_state(websocket, patient_state)
                        else:
                            # Remove current patient (simulate patient leaving)
                            pass
                
                print("✅ Simulation completed")
                
        except websockets.exceptions.ConnectionClosed:
            print("❌ WebSocket connection closed")
        except Exception as e:
            print(f"❌ Simulation error: {e}")
        finally:
            self.running = False
    
    def stop_simulation(self):
        """Stop the simulation."""
        self.running = False


async def main():
    """Main simulation function."""
    print("🚑 RescueLens Simulation Agent")
    print("This will generate synthetic patient data to test the triage system.")
    print("Make sure the backend server is running on localhost:8000")
    
    # Wait for user confirmation
    input("Press Enter to start simulation...")
    
    # Create and run simulation
    agent = SimulationAgent()
    
    try:
        # Run for 5 minutes with 2-second intervals
        await agent.run_simulation(duration_seconds=300, interval_seconds=2.0)
    except KeyboardInterrupt:
        print("\n⏹️ Simulation stopped by user")
        agent.stop_simulation()


if __name__ == "__main__":
    asyncio.run(main())

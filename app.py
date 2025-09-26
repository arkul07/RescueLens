"""
Main Streamlit application for AI-assisted triage system.
Provides video feed, dashboard, overrides, and logging capabilities.
"""

import streamlit as st
import cv2
import numpy as np
import pandas as pd
import time
from datetime import datetime
import json
import io

from perception import PerceptionAgent
from triage import TriageAgent
from simulation import SimulationAgent
from utils import (EventLogger, get_triage_color, format_timestamp, 
                   draw_patient_box, calculate_fps, get_status_indicator, 
                   create_patient_summary)


def initialize_session_state():
    """Initialize Streamlit session state."""
    if 'perception_agent' not in st.session_state:
        st.session_state.perception_agent = PerceptionAgent()
    if 'triage_agent' not in st.session_state:
        st.session_state.triage_agent = TriageAgent()
    if 'simulation_agent' not in st.session_state:
        st.session_state.simulation_agent = SimulationAgent()
    if 'event_logger' not in st.session_state:
        st.session_state.event_logger = EventLogger()
    if 'camera_active' not in st.session_state:
        st.session_state.camera_active = False
    if 'simulation_mode' not in st.session_state:
        st.session_state.simulation_mode = False
    if 'current_patients' not in st.session_state:
        st.session_state.current_patients = {}
    if 'frame_times' not in st.session_state:
        st.session_state.frame_times = []
    if 'fps' not in st.session_state:
        st.session_state.fps = 0.0
    if 'camera_cap' not in st.session_state:
        st.session_state.camera_cap = None
    if 'frame_count' not in st.session_state:
        st.session_state.frame_count = 0
    if 'last_processed_frame' not in st.session_state:
        st.session_state.last_processed_frame = None


def process_webcam_frame():
    """Process webcam frame for real-time triage."""
    if not st.session_state.camera_active or st.session_state.camera_cap is None:
        return None, [], {}
    
    # Read frame from camera
    ret, frame = st.session_state.camera_cap.read()
    if not ret:
        st.error("Failed to read from camera")
        return None, [], {}
    
    # Update frame count
    st.session_state.frame_count += 1
    
    # Always return the frame for display, even if not processing
    patient_states = []
    triage_decisions = {}
    
    # Process every N frames for performance
    process_every_n = getattr(st.session_state, 'process_every_n', 3)
    if st.session_state.frame_count % process_every_n == 0:
        # Process frame with perception agent
        patient_states = st.session_state.perception_agent.process_frame(frame, 30.0)  # Assume 30 FPS
        
        # Get triage decisions
        for patient_state in patient_states:
            st.session_state.event_logger.log_detection(patient_state)
            decision = st.session_state.triage_agent.analyze_patient(patient_state)
            st.session_state.event_logger.log_triage_decision(decision)
            triage_decisions[patient_state.id] = decision
        
        # Update current patients
        st.session_state.current_patients = {p.id: p for p in patient_states}
    
    # Store last processed frame
    st.session_state.last_processed_frame = frame
    
    return frame, patient_states, triage_decisions


def draw_patient_overlay(frame, patient_states, triage_decisions):
    """Draw patient overlays on video frame using enhanced utility functions."""
    overlay_frame = frame.copy()
    
    for patient_state in patient_states:
        # Get triage decision
        decision = triage_decisions.get(patient_state.id)
        if decision:
            triage_status = decision.final_decision or decision.ai_suggestion
            triage_color_hex = get_triage_color(triage_status)
            # Convert hex to BGR
            if triage_color_hex.startswith('#'):
                triage_color_hex = triage_color_hex[1:]
                bgr_color = tuple(int(triage_color_hex[i:i+2], 16) for i in (4, 2, 0))
            else:
                bgr_color = (0, 255, 0)
        else:
            triage_status = "UNKNOWN"
            bgr_color = (128, 128, 128)  # Gray for unknown
        
        # Use enhanced drawing function
        signal_quality = getattr(patient_state, 'signal_quality', 0.0)
        overlay_frame = draw_patient_box(
            overlay_frame, 
            patient_state.bounding_box, 
            bgr_color,
            patient_state.id,
            triage_status,
            patient_state.breathing_rate,
            patient_state.confidence,
            signal_quality
        )
    
    return overlay_frame


def main():
    """Main Streamlit application."""
    st.set_page_config(
        page_title="AI-Assisted Triage System",
        page_icon="🚑",
        layout="wide"
    )
    
    st.title("🚑 AI-Assisted Triage System")
    st.markdown("**Disaster Response & Low-Resource Medical Triage**")
    
    # Initialize session state
    initialize_session_state()
    
    # Sidebar controls
    with st.sidebar:
        st.header("System Controls")
        
        # Mode selection
        mode = st.radio(
            "Select Mode:",
            ["Live Camera", "Simulation", "Upload Video"],
            index=1  # Default to simulation
        )
        
        if mode == "Live Camera":
            st.subheader("📹 Live Video Analysis")
            
            # Enable camera mode
            if st.button("🎥 Start Live Analysis", type="primary"):
                st.session_state.camera_active = True
                st.session_state.simulation_mode = False
                st.session_state.frame_count = 0
                st.success("Live analysis started! Monitoring breathing patterns and audio cues...")
                st.rerun()
            
            if st.button("⏹️ Stop Live Analysis"):
                st.session_state.camera_active = False
                if hasattr(st.session_state, 'camera_cap') and st.session_state.camera_cap is not None:
                    st.session_state.camera_cap.release()
                    st.session_state.camera_cap = None
                st.session_state.current_patients = {}
                st.success("Live analysis stopped!")
                st.rerun()
            
            # Analysis settings
            st.subheader("⚙️ Analysis Settings")
            analysis_mode = st.selectbox(
                "Analysis Mode:",
                ["Breathing + Responsiveness", "Breathing Only", "Responsiveness Only"],
                help="Choose what to monitor for triage decisions"
            )
            
            sensitivity = st.slider(
                "Detection Sensitivity:",
                min_value=1,
                max_value=10,
                value=5,
                help="Higher = more sensitive detection, may have more false positives"
            )
            
            # Camera instructions
            st.info("""
            **Live Video Analysis:**
            • **Continuous monitoring** of breathing patterns
            • **Real-time triage** based on respiratory rate
            • **Audio cue detection** (when implemented)
            • **Automatic patient tracking** across frames
            • **Live status updates** with confidence scores
            """)
            
            # Camera status
            if st.session_state.camera_active:
                st.success("📹 Live Analysis Active")
                if hasattr(st.session_state, 'frame_count'):
                    st.info(f"Frames processed: {st.session_state.frame_count}")
            else:
                st.info("📹 Live Analysis Inactive")
        
        elif mode == "Simulation":
            st.session_state.simulation_mode = True
            st.session_state.camera_active = False
            
            # Simulation controls
            num_patients = st.slider("Number of Patients", 1, 10, 3)
            
            if st.button("Generate New Scenario", type="primary"):
                # Generate new simulation with realistic scenario
                frame, patient_states = st.session_state.simulation_agent.generate_realistic_scenario(num_patients)
                st.session_state.current_patients = {p.id: p for p in patient_states}
                
                # Process with agents
                for patient_state in patient_states:
                    st.session_state.event_logger.log_detection(patient_state)
                    decision = st.session_state.triage_agent.analyze_patient(patient_state)
                    st.session_state.event_logger.log_triage_decision(decision)
        
        elif mode == "Upload Video":
            uploaded_file = st.file_uploader(
                "Upload Video", 
                type=['mp4', 'avi', 'mov'],
                help="Upload video files up to 300MB"
            )
            if uploaded_file:
                st.session_state.uploaded_video = uploaded_file
                st.session_state.simulation_mode = False
                st.session_state.camera_active = False
                
                # Process uploaded video
                if st.button("Process Video", type="primary"):
                    st.session_state.process_video = True
    
    # Main content area
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.header("Video Feed")
        
        # FPS and status display
        col_fps, col_status = st.columns(2)
        with col_fps:
            st.metric("FPS", f"{st.session_state.fps:.1f}")
        with col_status:
            if st.session_state.current_patients:
                # Get status for first patient as example
                first_patient = list(st.session_state.current_patients.values())[0]
                decision = st.session_state.triage_agent.get_patient_triage_status(first_patient.id)
                status = get_status_indicator(first_patient, decision)
                st.info(f"Status: {status}")
            else:
                st.info("Status: No patients detected")
        
        # Video display
        if st.session_state.simulation_mode:
            # Simulation mode
            if st.session_state.current_patients:
                # Generate synthetic frame
                frame, patient_states = st.session_state.simulation_agent.generate_realistic_scenario(
                    len(st.session_state.current_patients)
                )
                
                # Update FPS calculation
                current_time = time.time()
                st.session_state.frame_times.append(current_time)
                if len(st.session_state.frame_times) > 30:  # Keep last 30 frames
                    st.session_state.frame_times = st.session_state.frame_times[-30:]
                st.session_state.fps = calculate_fps(st.session_state.frame_times)
                
                # Get triage decisions
                triage_decisions = st.session_state.triage_agent.get_all_triage_status()
                
                # Draw overlays
                overlay_frame = draw_patient_overlay(frame, patient_states, triage_decisions)
                
                # Display frame
                st.image(overlay_frame, channels="BGR", use_container_width=True)
            else:
                st.info("Click 'Generate New Scenario' to start simulation")
        
        elif st.session_state.camera_active:
            # Live video analysis using Streamlit's camera input
            st.info("📹 Live Video Analysis - Continuous Breathing & Audio Monitoring")
            
            # Use Streamlit's camera input for true live video
            camera_input = st.camera_input("Live Camera Feed", key="live_camera")
            
            if camera_input is not None:
                # Convert to OpenCV format for processing
                bytes_data = camera_input.getvalue()
                cv_image = cv2.imdecode(np.frombuffer(bytes_data, np.uint8), cv2.IMREAD_COLOR)
                
                if cv_image is not None:
                    # Process frame with perception agent
                    patient_states = st.session_state.perception_agent.process_frame(cv_image, 30.0)
                    
                    # Get triage decisions
                    triage_decisions = {}
                    for patient_state in patient_states:
                        st.session_state.event_logger.log_detection(patient_state)
                        decision = st.session_state.triage_agent.analyze_patient(patient_state)
                        st.session_state.event_logger.log_triage_decision(decision)
                        triage_decisions[patient_state.id] = decision
                    
                    # Update current patients
                    st.session_state.current_patients = {p.id: p for p in patient_states}
                    
                    # Draw overlays
                    if patient_states and triage_decisions:
                        overlay_frame = draw_patient_overlay(cv_image, patient_states, triage_decisions)
                    else:
                        overlay_frame = cv_image
                    
                    # Display processed frame
                    st.image(overlay_frame, channels="BGR", width='stretch', caption="Live Analysis with Patient Detection")
                    
                    # Show analysis results
                    if patient_states:
                        st.success(f"Detected {len(patient_states)} patient(s)")
                        for patient_state in patient_states:
                            decision = triage_decisions.get(patient_state.id)
                            if decision:
                                st.write(f"**Patient {patient_state.id}**: {decision.ai_suggestion} (Confidence: {decision.confidence:.2f})")
                    else:
                        st.info("No patients detected in this frame")
                else:
                    st.error("Failed to process camera image")
            
            # Live analysis status
            if st.session_state.current_patients:
                st.subheader("🫁 Live Breathing Analysis")
                for patient_id, patient in st.session_state.current_patients.items():
                    decision = st.session_state.triage_agent.get_patient_triage_status(patient_id)
                    col_breath1, col_breath2, col_breath3, col_breath4 = st.columns(4)
                    
                    with col_breath1:
                        st.metric(f"Patient {patient_id}", f"RR: {patient.breathing_rate:.1f}")
                    with col_breath2:
                        st.metric("Status", decision.ai_suggestion if decision else "Unknown")
                    with col_breath3:
                        st.metric("Confidence", f"{decision.confidence:.2f}" if decision else "0.00")
                    with col_breath4:
                        st.metric("Signal Quality", f"{getattr(patient, 'signal_quality', 0.0):.2f}")
            else:
                st.info("No patients currently detected. Click the camera button above to capture and analyze a frame.")
            
            # Live analysis controls
            st.subheader("🎛️ Live Analysis Controls")
            col_control1, col_control2, col_control3 = st.columns(3)
            
            with col_control1:
                if st.button("📊 Show Statistics", key="show_stats"):
                    if st.session_state.current_patients:
                        stats = st.session_state.triage_agent.get_triage_statistics()
                        st.write("**Current Triage Statistics:**")
                        for status, count in stats.items():
                            st.write(f"- {status}: {count}")
                    else:
                        st.info("No patients currently detected")
            
            with col_control2:
                if st.button("⏸️ Stop Live Analysis", key="stop_live"):
                    st.session_state.camera_active = False
                    st.session_state.current_patients = {}
                    st.success("Live analysis stopped!")
                    st.rerun()
            
            with col_control3:
                if st.button("🔄 Clear Analysis", key="clear_analysis"):
                    st.session_state.current_patients = {}
                    st.success("Analysis cleared!")
                    st.rerun()
            
            # Instructions for live analysis
            st.info("""
            **Live Analysis Features:**
            • **Click camera button** - Capture and analyze current frame
            • **Real-time detection** - Patient detection with colored boxes
            • **Breathing analysis** - Respiratory rate estimation
            • **Triage assessment** - RED/YELLOW/GREEN status
            • **Signal quality** - Confidence in breathing detection
            • **Manual refresh** - Click camera button for new analysis
            """)
        
        elif hasattr(st.session_state, 'uploaded_video') and st.session_state.uploaded_video:
            # Upload video mode
            if hasattr(st.session_state, 'process_video') and st.session_state.process_video:
                st.info("Processing uploaded video...")
                
                # Create a simple video processor
                import tempfile
                import os
                
                # Save uploaded file temporarily
                with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
                    tmp_file.write(st.session_state.uploaded_video.read())
                    video_path = tmp_file.name
                
                try:
                    # Process video frames
                    cap = cv2.VideoCapture(video_path)
                    frame_count = 0
                    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    fps = cap.get(cv2.CAP_PROP_FPS)
                    
                    # Process more frames and sample throughout the video
                    max_frames = min(30, total_frames)  # Process up to 30 frames
                    frame_interval = max(1, total_frames // max_frames)  # Sample evenly
                    
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    processed_patients = {}
                    
                    while frame_count < max_frames:
                        # Skip frames to sample evenly
                        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count * frame_interval)
                        ret, frame = cap.read()
                        if not ret:
                            break
                        
                        status_text.text(f"Processing frame {frame_count + 1}/{max_frames}")
                        progress_bar.progress((frame_count + 1) / max_frames)
                        
                        # Process frame with perception agent
                        patient_states = st.session_state.perception_agent.process_frame(frame, fps)
                        
                        # Get triage decisions and accumulate patient data
                        triage_decisions = {}
                        for patient_state in patient_states:
                            # Use a consistent patient ID based on position
                            position_key = f"{patient_state.position[0]//50}_{patient_state.position[1]//50}"
                            consistent_id = f"video_patient_{position_key}"
                            patient_state.id = consistent_id
                            
                            # Accumulate patient data for better analysis
                            if consistent_id not in processed_patients:
                                processed_patients[consistent_id] = {
                                    'states': [],
                                    'decisions': []
                                }
                            
                            processed_patients[consistent_id]['states'].append(patient_state)
                            
                            # Log detection
                            st.session_state.event_logger.log_detection(patient_state)
                            
                            # Analyze patient
                            decision = st.session_state.triage_agent.analyze_patient(patient_state)
                            processed_patients[consistent_id]['decisions'].append(decision)
                            triage_decisions[consistent_id] = decision
                            
                            # Log triage decision
                            st.session_state.event_logger.log_triage_decision(decision)
                        
                        # Draw overlays
                        overlay_frame = draw_patient_overlay(frame, patient_states, triage_decisions)
                        
                        # Display frame
                        st.image(overlay_frame, channels="BGR", use_container_width=True, 
                               caption=f"Frame {frame_count + 1} (Time: {frame_count * frame_interval / fps:.1f}s)")
                        
                        frame_count += 1
                    
                    cap.release()
                    progress_bar.empty()
                    status_text.empty()
                    
                    # Show summary of detected patients
                    if processed_patients:
                        st.success(f"Processed {frame_count} frames, detected {len(processed_patients)} patients")
                        
                        # Show patient summary
                        st.subheader("Detected Patients Summary")
                        for patient_id, data in processed_patients.items():
                            if data['decisions']:
                                latest_decision = data['decisions'][-1]
                                latest_state = data['states'][-1]
                                
                                col1, col2, col3 = st.columns(3)
                                with col1:
                                    st.write(f"**{patient_id}**")
                                with col2:
                                    st.write(f"Status: {latest_decision.final_decision or latest_decision.ai_suggestion}")
                                with col3:
                                    st.write(f"Confidence: {latest_decision.confidence:.2f}")
                    else:
                        st.warning("No patients detected in the video. This could be due to:")
                        st.write("- Poor video quality or lighting")
                        st.write("- People not clearly visible")
                        st.write("- Simplified detection algorithm")
                        st.write("- Try with a clearer video or use simulation mode for testing")
                    
                except Exception as e:
                    st.error(f"Error processing video: {str(e)}")
                finally:
                    # Clean up temporary file
                    if os.path.exists(video_path):
                        os.unlink(video_path)
            else:
                st.info("Click 'Process Video' to analyze the uploaded video")
        else:
            st.info("Select a mode from the sidebar to begin")
    
    with col2:
        st.header("Event Log")
        
        # Display recent events
        events = st.session_state.event_logger.events[-10:]  # Last 10 events
        
        if events:
            for event in reversed(events):  # Show newest first
                with st.expander(f"{format_timestamp(event['timestamp'])} - {event['type']}"):
                    if event['type'] == 'detection':
                        st.write(f"**Patient ID:** {event['patient_id']}")
                        st.write(f"**Breathing Rate:** {event['breathing_rate']:.1f} bpm")
                        st.write(f"**Is Breathing:** {event['is_breathing']}")
                        st.write(f"**Is Responsive:** {event['is_responsive']}")
                        st.write(f"**Confidence:** {event['confidence']:.2f}")
                    
                    elif event['type'] == 'triage_decision':
                        st.write(f"**Patient ID:** {event['patient_id']}")
                        st.write(f"**AI Suggestion:** {event['ai_suggestion']}")
                        st.write(f"**Confidence:** {event['confidence']:.2f}")
                        if event['human_override']:
                            st.write(f"**Human Override:** {event['human_override']}")
                        st.write(f"**Final Decision:** {event['final_decision']}")
                        st.write(f"**Reasoning:** {event['reasoning']}")
        else:
            st.info("No events recorded yet")
        
        # Triage statistics
        st.subheader("Triage Statistics")
        stats = st.session_state.triage_agent.get_triage_statistics()
        
        col_red, col_yellow, col_green, col_black, col_unknown = st.columns(5)
        with col_red:
            st.metric("RED", stats.get("RED", 0))
        with col_yellow:
            st.metric("YELLOW", stats.get("YELLOW", 0))
        with col_green:
            st.metric("GREEN", stats.get("GREEN", 0))
        with col_black:
            st.metric("BLACK", stats.get("BLACK", 0))
        with col_unknown:
            st.metric("UNKNOWN", stats.get("UNKNOWN", 0))
    
    # Patient override controls
    if st.session_state.current_patients:
        st.header("Patient Override Controls")
        
        # Create columns for each patient
        patient_cols = st.columns(min(len(st.session_state.current_patients), 4))
        
        for i, (patient_id, patient_state) in enumerate(st.session_state.current_patients.items()):
            with patient_cols[i % len(patient_cols)]:
                st.subheader(f"Patient {patient_id}")
                
                # Display current status
                decision = st.session_state.triage_agent.get_patient_triage_status(patient_id)
                if decision:
                    st.write(f"**Current Status:** {decision.final_decision or decision.ai_suggestion}")
                    st.write(f"**Confidence:** {decision.confidence:.2f}")
                    st.write(f"**Reasoning:** {decision.reasoning}")
                
                # Override controls
                override_options = ["No Override", "RED", "YELLOW", "GREEN", "BLACK", "UNKNOWN"]
                override = st.selectbox(
                    f"Override for {patient_id}:",
                    override_options,
                    key=f"override_{patient_id}"
                )
                
                if override != "No Override":
                    if st.button(f"Apply Override", key=f"apply_{patient_id}"):
                        st.session_state.triage_agent.set_human_override(patient_id, override)
                        st.success(f"Override applied: {override}")
                        st.rerun()
                
                if st.button(f"Clear Override", key=f"clear_{patient_id}"):
                    st.session_state.triage_agent.clear_human_override(patient_id)
                    st.success("Override cleared")
                    st.rerun()
    
    # Export controls
    st.header("Data Export")
    
    col_export1, col_export2 = st.columns(2)
    
    with col_export1:
        if st.button("Export Event Log (CSV)"):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"triage_log_{timestamp}.csv"
            st.session_state.event_logger.export_csv(filename)
            st.success(f"Event log exported to {filename}")
    
    with col_export2:
        if st.button("Export Event Log (JSON)"):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"triage_log_{timestamp}.json"
            st.session_state.event_logger.export_json(filename)
            st.success(f"Event log exported to {filename}")
    
    # System information
    with st.expander("System Information"):
        st.write("**AI-Assisted Triage System**")
        st.write("- **Perception Agent:** Person detection, breathing analysis, responsiveness detection")
        st.write("- **Triage Agent:** START protocol implementation with confidence scoring")
        st.write("- **Simulation Agent:** Synthetic patient generation for testing")
        st.write("- **Event Logging:** Real-time event tracking and export")
        
        st.write("\n**START Triage Protocol:**")
        st.write("- **RED:** No breathing OR RR > 30 OR RR < 10")
        st.write("- **YELLOW:** Breathing but unresponsive")
        st.write("- **GREEN:** Breathing and responsive")
        st.write("- **BLACK:** Deceased (sustained no breathing)")
        
        st.write("\n**System Status:**")
        st.write(f"- **Active Patients:** {len(st.session_state.current_patients)}")
        st.write(f"- **Total Events:** {len(st.session_state.event_logger.events)}")
        st.write(f"- **Mode:** {'Simulation' if st.session_state.simulation_mode else 'Live Camera'}")


if __name__ == "__main__":
    main()

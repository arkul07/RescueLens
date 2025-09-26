# 🚑 RescueLens - AI-Assisted Triage System (React + FastAPI)

A real-time AI-assisted triage system for disaster and low-resource scenarios, built with React frontend and FastAPI backend for true live video streaming and audio analysis.

## ✨ Features

### 🎥 **Real-time Video Analysis**
- **Live Camera Feed**: Continuous video streaming with real-time overlays
- **Person Detection**: Automatic detection of people in video frames
- **Breathing Analysis**: Optical flow-based breathing rate estimation
- **Responsiveness Detection**: Movement and pose analysis for patient responsiveness

### 🎤 **Audio Analysis**
- **Speech Recognition**: Real-time speech-to-text conversion
- **Distress Detection**: Keywords like "help", "pain", "hurt", "emergency"
- **Comfort Detection**: Keywords like "I'm ok", "I'm fine", "doing well"
- **Voice Quality Assessment**: Stress level and audio confidence scoring

### 🧠 **Enhanced Triage Logic**
- **START Protocol**: Medical triage with RED/YELLOW/GREEN/BLACK/UNKNOWN status
- **Multi-modal Analysis**: Combines visual + audio data for decisions
- **Confidence Scoring**: Weighted confidence based on signal quality
- **Human Override**: Manual triage decision overrides

### 📊 **Real-time Dashboard**
- **Live Video Feed**: Continuous camera stream with patient overlays
- **Patient Status**: Real-time patient information and triage decisions
- **Audio Visualization**: Live audio analysis and keyword detection
- **System Controls**: Start/stop camera, audio, and analysis
- **Export Functionality**: CSV/JSON log export

## 🏗️ Architecture

```
React Frontend (Port 3000) ←→ WebSocket ←→ FastAPI Backend (Port 8000)
     ↓                           ↓                    ↓
Live Video UI            Real-time Data        AI Processing
Audio Visualization      Communication         (Perception + Triage + Audio)
Status Dashboard         (Video + Audio)       Event Logging
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **Camera access** (webcam)
- **Microphone access** (for audio analysis)

### Installation & Startup

1. **Clone and navigate to the project:**
   ```bash
   cd RescueLens
   ```

2. **Run the automated startup script:**
   ```bash
   python3 start_react_app.py
   ```

   This script will:
   - Install Python dependencies (`requirements_react.txt`)
   - Install Node.js dependencies (`package.json`)
   - Start FastAPI backend on port 8000
   - Start React frontend on port 3000

3. **Access the application:**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **API Documentation**: http://localhost:8000/docs

### Manual Setup (Alternative)

If you prefer manual setup:

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements_react.txt
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Start FastAPI backend:**
   ```bash
   python3 fastapi_backend.py
   ```

4. **Start React frontend (in new terminal):**
   ```bash
   npm start
   ```

## 🎯 Usage

### 1. **Start the System**
- Open http://localhost:3000 in your browser
- Click "Start Camera" to begin video capture
- Click "Start Audio" to begin speech analysis
- Click "Start Analysis" to begin real-time triage

### 2. **Live Analysis**
- **Video Feed**: Shows live camera with patient overlays
- **Patient Detection**: Colored bounding boxes around detected people
- **Triage Status**: RED/YELLOW/GREEN/BLACK/UNKNOWN with reasoning
- **Audio Analysis**: Real-time speech recognition and keyword detection

### 3. **Patient Information**
- **Breathing Rate**: Estimated from chest motion analysis
- **Responsiveness**: Movement and pose analysis
- **Confidence Score**: Reliability of AI assessment
- **Audio Cues**: Detected distress or comfort keywords

### 4. **Controls**
- **Camera Controls**: Start/stop video capture
- **Audio Controls**: Start/stop speech analysis
- **Analysis Controls**: Start/stop real-time processing
- **Export Data**: Download CSV/JSON logs

## 🔧 Technical Details

### **Backend (FastAPI)**
- **Real-time Processing**: Continuous video and audio analysis
- **WebSocket Communication**: Live data streaming to frontend
- **AI Agents**: Perception, Triage, and Audio analysis modules
- **Event Logging**: Complete audit trail of all decisions

### **Frontend (React)**
- **Live Video Streaming**: Real-time camera feed with overlays
- **Audio Visualization**: Live audio analysis display
- **Responsive UI**: Modern, accessible interface
- **Real-time Updates**: WebSocket-based live data

### **AI Processing**
- **Perception Agent**: Person detection, breathing analysis, responsiveness
- **Audio Agent**: Speech recognition, keyword analysis, voice quality
- **Triage Agent**: START protocol with visual + audio integration
- **Event Logger**: Comprehensive logging and export

## 📁 Project Structure

```
RescueLens/
├── src/                          # React frontend
│   ├── components/
│   │   ├── VideoFeed.js         # Live video display
│   │   ├── StatusPanel.js       # Patient status
│   │   ├── ControlsPanel.js     # System controls
│   │   └── AudioVisualizer.js   # Audio analysis
│   ├── App.js                   # Main React app
│   ├── App.css                  # Styling
│   └── index.js                 # React entry point
├── public/
│   └── index.html               # HTML template
├── fastapi_backend.py           # FastAPI backend
├── audio.py                     # Audio analysis agent
├── perception.py                # Video analysis agent
├── triage.py                    # Enhanced triage logic
├── utils.py                     # Utility functions
├── requirements_react.txt       # Python dependencies
├── package.json                 # Node.js dependencies
├── start_react_app.py           # Automated startup
└── README_REACT.md              # This file
```

## 🎨 UI Components

### **Video Feed**
- Live camera stream with patient overlays
- Color-coded bounding boxes (RED/YELLOW/GREEN/BLACK/UNKNOWN)
- Patient information display
- FPS counter and status indicators

### **Status Panel**
- Patient list with triage decisions
- System statistics and health
- Audio analysis results
- Real-time updates

### **Controls Panel**
- Camera start/stop controls
- Audio start/stop controls
- Analysis start/stop controls
- Export functionality

### **Audio Visualizer**
- Live audio level visualization
- Keyword detection display
- Distress/comfort scoring
- Speaking indicator

## 🔍 API Endpoints

### **Camera Control**
- `POST /api/camera/start` - Start camera capture
- `POST /api/camera/stop` - Stop camera capture

### **Audio Control**
- `POST /api/audio/start` - Start audio listening
- `POST /api/audio/stop` - Stop audio listening

### **Analysis Control**
- `POST /api/analysis/start` - Start real-time analysis
- `POST /api/analysis/stop` - Stop analysis
- `POST /api/process_frame` - Process single frame

### **Data Export**
- `POST /api/export/csv` - Export CSV logs
- `POST /api/export/json` - Export JSON logs
- `GET /api/download/{filename}` - Download exported files

### **WebSocket**
- `ws://localhost:8000/ws` - Real-time communication

## 🚨 Troubleshooting

### **Camera Issues**
- Ensure camera permissions are granted
- Check if camera is being used by another application
- Try different camera indices in `fastapi_backend.py`

### **Audio Issues**
- Ensure microphone permissions are granted
- Check if microphone is working in other applications
- Install additional audio dependencies if needed

### **Performance Issues**
- Reduce video resolution in camera settings
- Increase analysis interval in backend
- Close other resource-intensive applications

### **Connection Issues**
- Check if ports 3000 and 8000 are available
- Ensure firewall allows local connections
- Restart both frontend and backend

## 🔒 Security Notes

- **Local Development**: This setup is for local development only
- **Camera Access**: Requires explicit user permission
- **Audio Access**: Requires explicit user permission
- **Data Privacy**: All processing happens locally, no data sent to external servers

## 🎯 Next Steps

1. **Test the System**: Run the startup script and test all functionality
2. **Customize Analysis**: Adjust triage thresholds and audio keywords
3. **Add Features**: Implement additional AI models or analysis methods
4. **Deploy**: Consider deployment options for production use

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the console logs for error messages
3. Ensure all dependencies are properly installed
4. Verify camera and microphone permissions

---

**RescueLens** - AI-Assisted Triage System for Emergency Response 🚑✨


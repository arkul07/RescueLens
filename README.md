# 🚑 RescueLens - AI-Assisted Triage System

**Disaster Response & Low-Resource Medical Triage**

RescueLens is an advanced AI-powered medical triage system designed for disaster response scenarios and low-resource medical environments. It combines computer vision, audio processing, and machine learning to provide real-time patient assessment and triage decisions.

## 🌟 Features

### 🎥 Real-Time Video Analysis
- **Live Camera Feed**: Continuous monitoring of patients via webcam
- **Breathing Pattern Detection**: Advanced computer vision algorithms to detect breathing patterns
- **Patient Detection**: Automatic identification and tracking of multiple patients
- **Visual Overlays**: Real-time triage status indicators with color-coded patient boxes

### 🎤 Audio Processing
- **Distress Detection**: Audio analysis to identify cries for help or medical distress
- **Background Noise Filtering**: Advanced audio processing to isolate important sounds
- **Real-Time Audio Visualization**: Live audio waveform display

### 🧠 AI-Powered Triage
- **Automated Triage Decisions**: RED, YELLOW, GREEN, BLACK classification system
- **Confidence Scoring**: AI confidence levels for each triage decision
- **Multi-Patient Support**: Simultaneous monitoring of multiple patients
- **Real-Time Updates**: Live triage status updates via WebSocket

### 📊 Data Management
- **Export Functionality**: Export triage logs in CSV and JSON formats
- **Event Logging**: Comprehensive logging of all detection and triage events
- **Historical Data**: Track patient status changes over time

## 🏗️ Architecture

### Backend (FastAPI)
- **Real-time Processing**: High-performance video and audio processing
- **WebSocket Communication**: Live data streaming to frontend
- **RESTful API**: Standard API endpoints for system control
- **Modular Design**: Separate modules for perception, triage, and audio processing

### Frontend (React)
- **Modern UI**: Clean, responsive interface optimized for medical environments
- **Real-time Updates**: Live video feed with patient overlays
- **Control Panel**: Easy-to-use controls for camera, audio, and analysis
- **Status Monitoring**: Real-time system status and patient information

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Webcam access
- Microphone access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/arkul07/RescueLens.git
   cd RescueLens
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Node.js dependencies**
   ```bash
   npm install
   ```

### Running the Application

1. **Start the FastAPI backend**
   ```bash
   python fastapi_backend.py
   ```
   The backend will be available at `http://localhost:8001`

2. **Start the React frontend**
   ```bash
   npm start
   ```
   The frontend will be available at `http://localhost:3000`

3. **Access the application**
   - Open your browser to `http://localhost:3000`
   - Grant camera and microphone permissions when prompted
   - Click "Start Camera" to begin live analysis

## 📖 Usage

### Basic Workflow
1. **Start the System**: Click "Start Camera" to begin live video analysis
2. **Monitor Patients**: The system will automatically detect and track patients
3. **Review Triage Decisions**: Color-coded overlays show triage status (RED/YELLOW/GREEN/BLACK)
4. **Export Data**: Use the export buttons to save triage logs for medical records

### Triage Color System
- 🔴 **RED**: Immediate attention required (critical)
- 🟡 **YELLOW**: Urgent attention needed (serious)
- 🟢 **GREEN**: Delayed treatment acceptable (minor)
- ⚫ **BLACK**: Deceased or expectant (no treatment needed)

## 🛠️ Technical Details

### Computer Vision
- **OpenCV**: Real-time video processing
- **Pose Detection**: Patient positioning and movement analysis
- **Breathing Detection**: Chest movement analysis for respiratory assessment

### Audio Processing
- **Real-time Audio**: Continuous microphone monitoring
- **Noise Filtering**: Background noise reduction
- **Distress Detection**: Pattern recognition for medical emergencies

### AI/ML Components
- **Perception Agent**: Computer vision processing
- **Triage Agent**: Decision-making algorithms
- **Event Logger**: Comprehensive data tracking

## 📁 Project Structure

```
RescueLens/
├── fastapi_backend.py      # Main FastAPI backend server
├── perception.py           # Computer vision and patient detection
├── triage.py              # Triage decision algorithms
├── audio.py               # Audio processing and analysis
├── utils.py               # Utility functions
├── requirements.txt       # Python dependencies
├── src/                   # React frontend
│   ├── App.js            # Main React application
│   ├── components/       # React components
│   │   ├── VideoFeed.js  # Video display component
│   │   ├── ControlsPanel.js # System controls
│   │   ├── StatusPanel.js   # Status display
│   │   └── AudioVisualizer.js # Audio visualization
│   └── index.js          # React entry point
├── public/               # Static assets
└── README.md            # This file
```

## 🔧 Configuration

### Backend Configuration
- **Camera Settings**: Adjustable frame rate and resolution
- **Analysis Frequency**: Configurable processing intervals
- **Audio Sensitivity**: Adjustable audio detection thresholds

### Frontend Configuration
- **UI Themes**: Dark/light mode support
- **Display Options**: Configurable overlay information
- **Export Formats**: Multiple data export options

## 🤝 Contributing

We welcome contributions to improve RescueLens! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please:
- Open an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

## 🎯 Roadmap

- [ ] Mobile app support
- [ ] Cloud deployment options
- [ ] Advanced ML models
- [ ] Multi-language support
- [ ] Integration with hospital systems

---

**RescueLens** - Saving lives through AI-powered medical triage 🚑✨

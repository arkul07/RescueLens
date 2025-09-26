# 🚑 RescueLens - AI-Assisted Triage System

**Disaster Response & Low-Resource Medical Triage MVP**

RescueLens is a lightweight, browser-based AI-powered medical triage system designed for disaster response scenarios and low-resource medical environments. It uses browser-side computer vision with MediaPipe Pose detection and real-time WebSocket communication to provide instant patient assessment and triage decisions.

## 🌟 Features

### 🎥 Browser-Side Video Analysis
- **MediaPipe Pose Detection**: Lightweight, real-time pose detection in the browser
- **Breathing Pattern Analysis**: Sliding window FFT-based respiratory rate estimation
- **Movement Classification**: Purposeful vs. low vs. none movement detection
- **Multi-Patient Tracking**: Simultaneous detection and tracking of multiple patients
- **Visual Overlays**: Real-time triage status with color-coded patient boxes

### 🎤 Audio Processing (Optional)
- **Web Audio API**: Real-time microphone analysis for breathing detection
- **Keyword Detection**: Simple keyword recognition for distress calls
- **Audio Quality Assessment**: SNR-based audio signal quality evaluation

### 🧠 START-Like Triage Rules
- **Automated Triage Decisions**: RED, YELLOW, GREEN, BLACK, UNKNOWN classification
- **Confidence Scoring**: Multi-factor confidence calculation
- **Human Override Support**: Manual override capability with reason tracking
- **Real-Time Updates**: Live triage status via WebSocket

### 📊 Data Management
- **Event Logging**: Comprehensive logging of AI decisions and human overrides
- **Export Functionality**: JSON and CSV export of triage logs
- **Privacy-First**: No raw video/audio data sent to backend

## 🏗️ Architecture

### Frontend (React + Vite + TypeScript)
- **Browser-Side Processing**: MediaPipe Pose detection runs locally
- **Real-Time Analysis**: Sliding window breathing and movement analysis
- **WebSocket Communication**: Live data streaming to backend
- **Modern UI**: Clean, responsive interface optimized for medical environments

### Backend (FastAPI)
- **WebSocket Endpoint**: Real-time patient state processing
- **START Triage Rules**: Medical triage decision engine
- **Event Logging**: In-memory event storage with export capabilities
- **Human Override API**: RESTful override submission

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Webcam access
- Modern browser with WebRTC support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/arkul07/RescueLens.git
   cd RescueLens
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start the FastAPI backend**
   ```bash
   cd backend
   python server.py
   ```
   The backend will be available at `http://localhost:8000`

2. **Start the React frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`

3. **Access the application**
   - Open your browser to `http://localhost:3000`
   - Grant camera and microphone permissions when prompted
   - Click "Start Detection" to begin live analysis

### Optional: Run Simulation
```bash
cd scripts
pip install -r requirements.txt
python simulation.py
```

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
├── backend/                    # FastAPI backend
│   ├── server.py              # Main FastAPI server
│   ├── models.py              # Pydantic data models
│   ├── triage.py              # START triage rules
│   ├── store.py               # Event log storage
│   └── requirements.txt      # Python dependencies
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx            # Main React application
│   │   ├── types.ts           # TypeScript interfaces
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useMedia.ts    # Camera/microphone access
│   │   │   ├── usePerception.ts # MediaPipe pose detection
│   │   │   └── useWebSocket.ts # WebSocket communication
│   │   └── utils/
│   │       └── draw.ts        # Canvas overlay utilities
│   ├── package.json           # Node.js dependencies
│   └── vite.config.js         # Vite configuration
├── scripts/                    # Optional simulation
│   ├── simulation.py          # Synthetic patient generator
│   └── requirements.txt       # Simulation dependencies
└── README.md                  # This file
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

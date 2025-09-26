import React, { useState, useEffect, useRef } from 'react';
// Removed socket.io import - using native WebSockets
import axios from 'axios';
import styled from 'styled-components';
import VideoFeed from './components/VideoFeed';
import StatusPanel from './components/StatusPanel';
import ControlsPanel from './components/ControlsPanel';
import AudioVisualizer from './components/AudioVisualizer';
import './App.css';

const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  background: #1a1a1a;
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
`;

const Sidebar = styled.div`
  width: 350px;
  background: #2a2a2a;
  padding: 20px;
  border-left: 1px solid #444;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #444;
`;

const Title = styled.h1`
  color: #00ff88;
  margin: 0;
  font-size: 24px;
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: ${props => props.status === 'active' ? '#00ff88' : props.status === 'error' ? '#ff4444' : '#666'};
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
`;

function App() {
  // WebSocket connection
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // System state
  const [cameraActive, setCameraActive] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(false);
  
  // Data state
  const [currentFrame, setCurrentFrame] = useState(null);
  const [patients, setPatients] = useState([]);
  const [triageDecisions, setTriageDecisions] = useState([]);
  const [audioAnalysis, setAudioAnalysis] = useState(null);
  const [fps, setFps] = useState(0);
  const [systemStatus, setSystemStatus] = useState({});
  
  // Refs
  const frameIntervalRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = new WebSocket('ws://localhost:8001/ws');
    
    newSocket.onopen = () => {
      console.log('🔗 Connected to backend');
      setConnected(true);
    };
    
    newSocket.onclose = () => {
      console.log('🔌 Disconnected from backend');
      setConnected(false);
    };
    
    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'frame_update') {
          setCurrentFrame(data.frame);
          setPatients(data.patients || []);
          setTriageDecisions(data.triage_decisions || []);
          setAudioAnalysis(data.audio_analysis);
          setFps(data.fps || 0);
        } else if (data.type === 'camera_status') {
          setCameraActive(data.status === 'success');
        } else if (data.type === 'audio_status') {
          setAudioActive(data.status === 'success');
        } else if (data.type === 'analysis_status') {
          setAnalysisActive(data.status === 'success');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);

  // Fetch system status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get('http://localhost:8001/api/status');
        setSystemStatus(response.data);
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Start continuous frame processing (now handled by WebSocket)
  const startFrameProcessing = () => {
    // WebSocket will handle real-time updates
    console.log('Frame processing started via WebSocket');
  };

  // Stop continuous frame processing
  const stopFrameProcessing = () => {
    // WebSocket will stop sending updates when camera stops
    console.log('Frame processing stopped via WebSocket');
  };

  // Handle camera start
  const handleStartCamera = async () => {
    try {
      const response = await axios.post('http://localhost:8001/api/camera/start');
      if (response.data.status === 'success') {
        console.log('Camera started successfully');
        // WebSocket will handle real-time updates
      }
    } catch (error) {
      console.error('Error starting camera:', error);
    }
  };

  // Handle camera stop
  const handleStopCamera = async () => {
    try {
      await axios.post('http://localhost:8001/api/camera/stop');
      setCurrentFrame(null);
      setPatients([]);
      setTriageDecisions([]);
      console.log('Camera stopped successfully');
    } catch (error) {
      console.error('Error stopping camera:', error);
    }
  };

  // Handle audio start
  const handleStartAudio = async () => {
    try {
      await axios.post('http://localhost:8001/api/audio/start');
    } catch (error) {
      console.error('Error starting audio:', error);
    }
  };

  // Handle audio stop
  const handleStopAudio = async () => {
    try {
      await axios.post('http://localhost:8001/api/audio/stop');
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  // Handle analysis start
  const handleStartAnalysis = async () => {
    try {
      await axios.post('http://localhost:8001/api/analysis/start');
    } catch (error) {
      console.error('Error starting analysis:', error);
    }
  };

  // Handle analysis stop
  const handleStopAnalysis = async () => {
    try {
      await axios.post('http://localhost:8001/api/analysis/stop');
    } catch (error) {
      console.error('Error stopping analysis:', error);
    }
  };

  // Export logs
  const handleExportLogs = async (format) => {
    try {
      const response = await axios.post(`http://localhost:8001/api/export/${format}`);
      if (response.data.status === 'success') {
        // Download the file
        window.open(`http://localhost:8001/api/download/${response.data.filename}`, '_blank');
      }
    } catch (error) {
      console.error('Error exporting logs:', error);
    }
  };

  return (
    <AppContainer>
      <MainContent>
        <Header>
          <Title>🚑 RescueLens - AI-Assisted Triage</Title>
          <StatusIndicator status={connected ? 'active' : 'error'}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </StatusIndicator>
        </Header>
        
        <VideoFeed 
          frame={currentFrame}
          patients={patients}
          triageDecisions={triageDecisions}
          fps={fps}
        />
        
        <ControlsPanel
          cameraActive={cameraActive}
          audioActive={audioActive}
          analysisActive={analysisActive}
          onStartCamera={handleStartCamera}
          onStopCamera={handleStopCamera}
          onStartAudio={handleStartAudio}
          onStopAudio={handleStopAudio}
          onStartAnalysis={handleStartAnalysis}
          onStopAnalysis={handleStopAnalysis}
          onExportLogs={handleExportLogs}
        />
      </MainContent>
      
      <Sidebar>
        <StatusPanel
          patients={patients}
          triageDecisions={triageDecisions}
          audioAnalysis={audioAnalysis}
          systemStatus={systemStatus}
        />
        
        <AudioVisualizer
          audioAnalysis={audioAnalysis}
          audioActive={audioActive}
        />
      </Sidebar>
    </AppContainer>
  );
}

export default App;

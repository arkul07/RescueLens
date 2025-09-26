import React, { useState } from 'react';
import CameraAnalysis from './components/CameraAnalysis';
import VideoUploadAnalysis from './components/VideoUploadAnalysis';
import './App.css';

type AppMode = 'live' | 'upload' | 'synthetic';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('live');

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚑 RescueLens - AI-Assisted Triage</h1>
        
        <div className="mode-selector">
          <button 
            className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
            onClick={() => setMode('live')}
          >
            📹 Live Feed
          </button>
          <button 
            className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => setMode('upload')}
          >
            📁 Upload Video
          </button>
          <button 
            className={`mode-btn ${mode === 'synthetic' ? 'active' : ''}`}
            onClick={() => setMode('synthetic')}
          >
            🧪 Synthetic Data
          </button>
        </div>
      </header>

      <div className="main-content">
        {mode === 'live' && <CameraAnalysis />}
        
        {mode === 'upload' && <VideoUploadAnalysis />}
        
        {mode === 'synthetic' && (
          <div className="synthetic-container">
            <div className="synthetic-area">
              <div className="synthetic-icon">🧪</div>
              <div className="synthetic-text">Synthetic Data Mode</div>
              <div className="synthetic-subtext">Generating test patient data for analysis</div>
              <button 
                className="control-btn start"
                onClick={() => {
                  // TODO: Start synthetic data generation
                  console.log('Starting synthetic data generation...');
                }}
              >
                ▶️ Start Synthetic Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
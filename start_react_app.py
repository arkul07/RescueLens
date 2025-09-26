#!/usr/bin/env python3
"""
Startup script for RescueLens React + FastAPI application.

This script:
1. Installs Python dependencies
2. Installs Node.js dependencies  
3. Starts the FastAPI backend
4. Starts the React frontend
"""

import subprocess
import sys
import time
import os
import signal
import threading
from pathlib import Path

def run_command(command, cwd=None, shell=True):
    """Run a command and return the result."""
    try:
        result = subprocess.run(
            command, 
            shell=shell, 
            cwd=cwd, 
            capture_output=True, 
            text=True
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def install_python_deps():
    """Install Python dependencies."""
    print("🐍 Installing Python dependencies...")
    success, stdout, stderr = run_command("pip install -r requirements_react.txt")
    if success:
        print("✅ Python dependencies installed")
        return True
    else:
        print(f"❌ Failed to install Python dependencies: {stderr}")
        return False

def install_node_deps():
    """Install Node.js dependencies."""
    print("📦 Installing Node.js dependencies...")
    success, stdout, stderr = run_command("npm install")
    if success:
        print("✅ Node.js dependencies installed")
        return True
    else:
        print(f"❌ Failed to install Node.js dependencies: {stderr}")
        return False

def start_fastapi_backend():
    """Start the FastAPI backend."""
    print("🚀 Starting FastAPI backend...")
    try:
        # Start FastAPI backend in background
        process = subprocess.Popen([
            sys.executable, "fastapi_backend.py"
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Wait a moment for startup
        time.sleep(3)
        
        if process.poll() is None:
            print("✅ FastAPI backend started on http://localhost:8000")
            return process
        else:
            print("❌ FastAPI backend failed to start")
            return None
    except Exception as e:
        print(f"❌ Error starting FastAPI backend: {e}")
        return None

def start_react_frontend():
    """Start the React frontend."""
    print("⚛️ Starting React frontend...")
    try:
        # Start React development server
        process = subprocess.Popen([
            "npm", "start"
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Wait a moment for startup
        time.sleep(5)
        
        if process.poll() is None:
            print("✅ React frontend started on http://localhost:3000")
            return process
        else:
            print("❌ React frontend failed to start")
            return None
    except Exception as e:
        print(f"❌ Error starting React frontend: {e}")
        return None

def main():
    """Main startup function."""
    print("🚑 Starting RescueLens - AI-Assisted Triage System")
    print("=" * 60)
    
    # Check if we're in the right directory
    if not Path("fastapi_backend.py").exists():
        print("❌ Please run this script from the RescueLens directory")
        sys.exit(1)
    
    # Install dependencies
    if not install_python_deps():
        sys.exit(1)
    
    if not install_node_deps():
        sys.exit(1)
    
    # Start backend
    backend_process = start_fastapi_backend()
    if not backend_process:
        sys.exit(1)
    
    # Start frontend
    frontend_process = start_react_frontend()
    if not frontend_process:
        backend_process.terminate()
        sys.exit(1)
    
    print("\n🎉 RescueLens is now running!")
    print("📱 Frontend: http://localhost:3000")
    print("🔧 Backend: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("\nPress Ctrl+C to stop both servers")
    
    try:
        # Keep both processes running
        while True:
            time.sleep(1)
            
            # Check if processes are still running
            if backend_process.poll() is not None:
                print("❌ FastAPI backend stopped unexpectedly")
                break
            
            if frontend_process.poll() is not None:
                print("❌ React frontend stopped unexpectedly")
                break
                
    except KeyboardInterrupt:
        print("\n🛑 Shutting down RescueLens...")
        
        # Terminate processes
        if backend_process:
            backend_process.terminate()
            print("✅ FastAPI backend stopped")
        
        if frontend_process:
            frontend_process.terminate()
            print("✅ React frontend stopped")
        
        print("👋 RescueLens stopped successfully")

if __name__ == "__main__":
    main()


const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../client/public/favicon.ico'),
  });

  // In development, load from React dev server
  // In production, load from built files
  const isDev = process.env.ELECTRON_START_URL !== undefined;
  const startURL = isDev 
    ? process.env.ELECTRON_START_URL 
    : `file://${path.resolve(__dirname, '../client/build/index.html')}`;
  
  mainWindow.loadURL(startURL);

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function waitForServer(maxAttempts = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkServer = () => {
      attempts++;
      
      const req = http.get('http://localhost:5000/api/health', (res) => {
        if (res.statusCode === 200) {
          console.log('Server is ready!');
          resolve();
        } else {
          retry();
        }
      });
      
      req.on('error', () => {
        retry();
      });
      
      req.setTimeout(1000);
    };
    
    const retry = () => {
      if (attempts >= maxAttempts) {
        reject(new Error('Server failed to start within timeout'));
      } else {
        setTimeout(checkServer, interval);
      }
    };
    
    checkServer();
  });
}

function startServer() {
  // Validate server file exists
  const serverPath = path.join(__dirname, '../server/index.js');
  
  if (!fs.existsSync(serverPath)) {
    console.error(`Server file not found at: ${serverPath}`);
    throw new Error('Server file not found');
  }
  
  // Start the Express server
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, ELECTRON_MODE: 'true' }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

app.on('ready', async () => {
  try {
    // In development mode, server is already running via concurrently
    // Only start server in production (when packaged)
    const isDev = process.env.ELECTRON_START_URL !== undefined;
    
    if (!isDev) {
      startServer();
    }
    
    // Wait for server to be ready before creating window
    await waitForServer();
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  // Clean up server process gracefully
  if (serverProcess) {
    // Try graceful shutdown first
    serverProcess.kill('SIGTERM');
    
    // Force kill after timeout if still running
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log('Forcing server shutdown...');
        serverProcess.kill('SIGKILL');
      }
    }, 5000);
  }
});

const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;

// Disable hardware acceleration to avoid GPU rendering issues
app.disableHardwareAcceleration();

// Function to check if dev server is ready
function isDevServerReady(url, timeout = 30000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkServer = () => {
      const req = http.get(url, (res) => {
        resolve(true);
      });
      
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          resolve(false);
        } else {
          // Retry after 500ms
          setTimeout(checkServer, 500);
        }
      });
      
      req.setTimeout(1000, () => {
        req.destroy();
        if (Date.now() - startTime > timeout) {
          resolve(false);
        } else {
          setTimeout(checkServer, 500);
        }
      });
    };
    
    checkServer();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    backgroundColor: '#ffffff', // Set white background to prevent transparency issues
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    }
  });

  // Force DevTools to open in development (always open to see errors)
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  } else {
    // Also open in production for debugging if needed
    // mainWindow.webContents.openDevTools();
  }

  // Load the app
  if (!app.isPackaged) {
    // Development: Wait for Vite dev server to be ready
    const devServerUrl = 'http://localhost:5173';
    console.log('Waiting for Vite dev server to be ready...');
    
    const serverReady = await isDevServerReady(devServerUrl);
    
    if (serverReady) {
      console.log('Dev server is ready, loading...');
      try {
        await mainWindow.loadURL(devServerUrl);
        console.log('Successfully loaded dev server');
        
        // Show window after content is loaded
        mainWindow.once('ready-to-show', () => {
          mainWindow.show();
        });
      } catch (error) {
        console.error('Failed to load dev server:', error);
        mainWindow.show(); // Show window even if load fails so user can see error
      }
    } else {
      console.error('Dev server is not ready after timeout');
      // Load anyway - might work
      try {
        await mainWindow.loadURL(devServerUrl);
        mainWindow.show();
      } catch (error) {
        console.error('Failed to load:', error);
        mainWindow.show();
      }
    }

    // Handle navigation errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', errorCode, errorDescription, validatedURL);
      if (errorCode === -105 || errorCode === -106) {
        // Connection refused or connection reset - server might not be ready
        console.log('Retrying in 2 seconds...');
        setTimeout(() => {
          mainWindow.loadURL(devServerUrl).catch(err => {
            console.error('Retry failed:', err);
          });
        }, 2000);
      }
    });
  } else {
    // Production: Load from built files
    try {
      await mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
      mainWindow.once('ready-to-show', () => {
        mainWindow.show();
      });
    } catch (error) {
      console.error('Failed to load production build:', error);
      mainWindow.show();
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  // Log any app errors
  app.on('render-process-gone', (event, webContents, details) => {
    console.error('Render process gone:', details);
  });
  
  app.on('child-process-gone', (event, details) => {
    console.error('Child process gone:', details);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


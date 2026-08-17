// Helper script to kill process on a specific port
// Usage: node scripts/kill-port.js 5173

const { exec } = require('child_process');
const port = process.argv[2] || '5173';

if (process.platform === 'win32') {
  // Windows
  exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
    if (error || !stdout) {
      console.log(`Port ${port} is not in use.`);
      return;
    }
    
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && !isNaN(pid)) {
        pids.add(pid);
      }
    });
    
    if (pids.size === 0) {
      console.log(`Port ${port} is not in use.`);
      return;
    }
    
    pids.forEach(pid => {
      exec(`taskkill /PID ${pid} /F`, (err) => {
        if (err) {
          console.error(`Failed to kill process ${pid}:`, err.message);
        } else {
          console.log(`Killed process ${pid} using port ${port}`);
        }
      });
    });
  });
} else {
  // Unix/Mac
  exec(`lsof -ti:${port}`, (error, stdout) => {
    if (error || !stdout) {
      console.log(`Port ${port} is not in use.`);
      return;
    }
    
    const pids = stdout.trim().split('\n').filter(Boolean);
    pids.forEach(pid => {
      exec(`kill -9 ${pid}`, (err) => {
        if (err) {
          console.error(`Failed to kill process ${pid}:`, err.message);
        } else {
          console.log(`Killed process ${pid} using port ${port}`);
        }
      });
    });
  });
}


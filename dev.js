const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');

// 1. Build everything
console.log('Building preload...');
execSync('npx esbuild src/preload/index.ts --bundle --platform=node --outfile=dist/preload.js --external:electron --alias:@shared=src/shared', { stdio: 'inherit' });

console.log('Building main...');
execSync('npx esbuild src/main/index.ts --bundle --platform=node --outfile=dist/main.js --external:electron --external:systeminformation --alias:@shared=src/shared --alias:@main=src/main --define:MAIN_WINDOW_VITE_DEV_SERVER_URL=\'"http://localhost:5173"\' --define:MAIN_WINDOW_VITE_NAME=\'"main_window"\'', { stdio: 'inherit' });

console.log('Building renderer...');
execSync('npx vite build --config vite.renderer.config.ts', { stdio: 'inherit' });

// 2. Serve built renderer on port 5173
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const RENDERER_DIR = path.join(__dirname, '.vite', 'renderer', 'main_window');

const server = http.createServer((req, res) => {
  let url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(RENDERER_DIR, url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(path.join(RENDERER_DIR, 'index.html')).pipe(res);
  }
});

server.listen(5173, () => {
  console.log('Renderer served on http://localhost:5173');

  // 3. Launch Electron
  console.log('Launching Electron...');
  const el = spawn('npx', ['electron', 'dist/main.js'], { stdio: 'inherit', shell: true });
  el.on('close', (code) => {
    console.log('Electron exited:', code);
    server.close();
    process.exit(code || 0);
  });
});

process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});

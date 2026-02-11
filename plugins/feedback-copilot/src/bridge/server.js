const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { ConnectionManager } = require('./connection');

class BridgeServer {
  constructor(port = 3847) {
    this.port = port;
    this.startPort = port;
    this.maxRetries = 10;
    this.app = express();
    this.server = null;
    this.connection = new ConnectionManager();
    this.bookmarkletUrl = null;

    // CORS + permissions for cross-origin iframe usage
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Permissions-Policy', 'microphone=(self)');
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    });

    // Serve overlay.js with dynamic port injection
    this.app.get('/overlay.js', (req, res) => {
      const overlayPath = path.join(__dirname, '..', 'panel', 'overlay.js');
      let script = fs.readFileSync(overlayPath, 'utf8');
      script = script.replace(/__PORT__/g, String(this.port));
      res.type('application/javascript').send(script);
    });

    // Serve bookmarklet instruction page
    this.app.get('/bookmarklet', (req, res) => {
      const bookmarkletCode = `javascript:void(document.body.appendChild(Object.assign(document.createElement('script'),{src:'http://localhost:${this.port}/overlay.js'})))`;
      const consoleCode = `document.body.appendChild(Object.assign(document.createElement('script'),{src:'http://localhost:${this.port}/overlay.js'}))`;
      res.type('text/html').send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Feedback Copilot</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 24px; color: #1d1d1f; line-height: 1.6; }
  h1 { font-size: 24px; font-weight: 600; }
  p { color: #6e6e73; }
  a.bookmarklet { display: inline-block; padding: 14px 28px; background: #0071e3; color: white; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 16px 0; cursor: grab; }
  a.bookmarklet:hover { background: #0077ED; }
  code { background: #f0f0f0; padding: 3px 8px; border-radius: 6px; font-size: 13px; word-break: break-all; }
  .step { margin: 20px 0; padding: 16px; background: #fafafa; border-radius: 12px; border: 1px solid rgba(0,0,0,0.06); }
  .step-num { font-weight: 700; color: #0071e3; }
  .alt { margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.06); }
</style></head>
<body>
  <h1>Feedback Copilot</h1>
  <p>Inject the review panel as a floating overlay on any page.</p>

  <div class="step"><span class="step-num">1.</span> Drag this to your bookmarks bar:</div>
  <a class="bookmarklet" href="${bookmarkletCode}">Feedback Copilot</a>

  <div class="step"><span class="step-num">2.</span> Navigate to your app (e.g. <code>localhost:3000</code>)</div>
  <div class="step"><span class="step-num">3.</span> Click the bookmarklet. The floating panel appears.</div>

  <div class="alt">
    <p><strong>Alternative:</strong> Paste this into your browser console:</p>
    <code>${consoleCode}</code>
  </div>
</body></html>`);
    });

    // Serve the panel static files
    this.app.use(express.static(path.join(__dirname, '..', 'panel')));
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app);
      const wss = new WebSocketServer({ server: this.server });

      wss.on('connection', (ws) => {
        this.connection.register(ws);
      });

      this.server.listen(this.port, () => {
        this.url = `http://localhost:${this.port}`;
        this.bookmarkletUrl = `${this.url}/bookmarklet`;
        resolve();
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          if (this.port - this.startPort >= this.maxRetries) {
            reject(new Error(`No available port after ${this.maxRetries} attempts (tried ${this.startPort}-${this.port}). Run: npx kill-port ${this.startPort}`));
            return;
          }
          process.stderr.write(`Feedback Copilot: port ${this.port} in use, trying ${this.port + 1}...\n`);
          this.port++;
          this.server.listen(this.port);
        } else {
          reject(err);
        }
      });
    });
  }

  send(event, data) {
    this.connection.send({ event, data });
  }

  waitForEvent(eventName, timeout = 120000) {
    return this.connection.waitForEvent(eventName, timeout);
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.connection.close();
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }
}

module.exports = { BridgeServer };

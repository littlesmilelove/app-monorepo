#!/usr/bin/env node

/**
 * Performance Monitoring Server
 *
 * Receives performance data via WebSocket and stores it for analysis.
 *
 * Usage:
 *   node development/performance-server/server.js
 *
 * Environment variables:
 *   PERF_SERVER_PORT - Server port (default: 9527)
 *   PERF_OUTPUT_DIR  - Output directory (default: development/output/perf-sessions)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const storage = require('./storage');
const analyzer = require('../scripts/analyze-func-perf');

const PORT = parseInt(process.env.PERF_SERVER_PORT || '9527', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// Active sessions (for real-time updates)
const activeSessions = new Map();

// HTTP server for static files and API
const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'api' && segments[1] === 'sessions') {
    const sessionId = segments[2];
    const action = segments[3];
    if (!sessionId) {
      handleGetSessions(req, res);
      return;
    }
    if (action === 'analysis') {
      handleGetSessionAnalysis(req, res, sessionId);
      return;
    }
    if (action === 'speedscope') {
      handleGetSessionSpeedscope(req, res, sessionId);
      return;
    }
    handleGetSession(req, res, sessionId);
    return;
  }

  // Static files
  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// WebSocket server
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientIp}`);

  let sessionId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // First message should contain sessionId
      if (!sessionId && message.sessionId) {
        sessionId = message.sessionId;
        activeSessions.set(sessionId, {
          ws,
          startTime: Date.now(),
          platform: message.platform || 'unknown',
          eventCount: 0,
        });
        console.log(`[WS] Session started: ${sessionId} (${message.platform || 'unknown'})`);
      }

      if (sessionId) {
        // Store the event
        storage.appendEvent(sessionId, message);

        // Update session stats
        const session = activeSessions.get(sessionId);
        if (session) {
          session.eventCount++;
        }
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err.message);
    }
  });

  ws.on('close', () => {
    if (sessionId) {
      const session = activeSessions.get(sessionId);
      if (session) {
        console.log(`[WS] Session ended: ${sessionId} (${session.eventCount} events)`);
        activeSessions.delete(sessionId);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });
});

// API handlers
function handleGetSessions(req, res) {
  try {
    const sessions = storage.listSessions();

    // Add active session info
    const result = sessions.map((s) => ({
      ...s,
      active: activeSessions.has(s.sessionId),
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[API] Error listing sessions:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSession(req, res, sessionId) {
  try {
    const data = storage.getSessionData(sessionId);
    if (!data) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('[API] Error getting session:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionAnalysis(req, res, sessionId) {
  try {
    const data = storage.getSessionData(sessionId);
    if (!data || !data.events) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }
    const entries = (data.events.function_call || [])
      .map(analyzer.normalizeEntry)
      .filter(Boolean);

    const analysis = analyzer.analyzeEntries(entries);

    let minTs = Infinity;
    let maxTs = 0;
    for (const e of entries) {
      if (Number.isFinite(e.ts)) {
        minTs = Math.min(minTs, e.ts);
        maxTs = Math.max(maxTs, e.ts + (e.duration || 0));
      }
    }
    const moduleSet = new Set(entries.map((e) => e.module || 'unknown'));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        sessionId,
        totalEntries: entries.length,
        timeRange: {
          start: minTs === Infinity ? 0 : minTs,
          end: maxTs,
          span: maxTs - (minTs === Infinity ? 0 : minTs),
        },
        modules: Array.from(moduleSet),
        analysis,
        meta: data.meta || null,
      }),
    );
  } catch (err) {
    console.error('[API] Error analyzing session:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleGetSessionSpeedscope(req, res, sessionId) {
  try {
    const data = storage.getSessionData(sessionId);
    if (!data || !data.events) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }
    const entries = (data.events.function_call || [])
      .map(analyzer.normalizeEntry)
      .filter(Boolean);
    const speedscope = analyzer.buildSpeedscope(entries, `Session ${sessionId}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(speedscope));
  } catch (err) {
    console.error('[API] Error building speedscope:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// Start server
httpServer.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('  OneKey Performance Monitor Server');
  console.log('='.repeat(60));
  console.log('');
  console.log(`  WebSocket:  ws://localhost:${PORT}`);
  console.log(`  Dashboard:  http://localhost:${PORT}`);
  console.log(`  API:        http://localhost:${PORT}/api/sessions`);
  console.log('');
  console.log(`  Output:     ${storage.OUTPUT_DIR}`);
  console.log('');
  console.log('  Waiting for connections...');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  wss.close();
  httpServer.close();
  process.exit(0);
});

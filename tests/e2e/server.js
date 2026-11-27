/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Opaque-box E2E static HTTP server for omni-animalia PWA */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function isContained(rootDir, targetPath) {
  return targetPath === rootDir || targetPath.startsWith(rootDir + path.sep);
}

function sendError(res, statusCode, message) {
  if (res.writableEnded || res.destroyed || res.headersSent) return;
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(message);
}

function sendCached(req, res, cached) {
  if (res.writableEnded || res.destroyed || res.headersSent) return;
  res.writeHead(200, {
    'Content-Type': cached.contentType,
    'Content-Length': cached.data.length,
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(cached.data);
  }
}

function startStaticServer(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const sockets = new Set();
  const fileCache = new Map();

  const server = http.createServer((req, res) => {
    let aborted = false;
    req.on('aborted', () => {
      aborted = true;
    });
    res.on('error', () => {
      aborted = true;
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendError(res, 405, 'Method Not Allowed');
    }

    let pathname;
    try {
      const rawUrl = String(req.url || '/').split('?')[0].split('#')[0];
      const decodedRaw = decodeURIComponent(rawUrl);
      if (decodedRaw.includes('\0') || decodedRaw.split(/[/\\]/).some((seg) => seg === '..')) {
        return sendError(res, 403, 'Forbidden');
      }
      const parsed = new URL(req.url || '/', 'http://127.0.0.1');
      pathname = decodeURIComponent(parsed.pathname);
    } catch (err) {
      return sendError(res, 400, 'Bad Request');
    }

    if (pathname.includes('\0')) {
      return sendError(res, 403, 'Forbidden');
    }

    // Check path segments for explicit traversal attempts
    const segments = pathname.split(/[/\\]/);
    if (segments.some((seg) => seg === '..')) {
      return sendError(res, 403, 'Forbidden');
    }

    const relPath = pathname.replace(/^\/+/, '') || 'index.html';
    const candidate = path.resolve(resolvedRoot, relPath);

    if (!isContained(resolvedRoot, candidate)) {
      return sendError(res, 403, 'Forbidden');
    }

    const directHit = fileCache.get(candidate);
    if (directHit) {
      return sendCached(req, res, directHit);
    }

    fs.stat(candidate, (statErr, stats) => {
      if (aborted) return;
      if (statErr) {
        return sendError(res, 404, 'Not Found');
      }

      let target = candidate;
      if (stats.isDirectory()) {
        const indexCandidate = path.join(candidate, 'index.html');
        if (!isContained(resolvedRoot, indexCandidate)) {
          return sendError(res, 403, 'Forbidden');
        }
        try {
          const idxStats = fs.statSync(indexCandidate);
          if (!idxStats.isFile()) {
            return sendError(res, 404, 'Not Found');
          }
          target = indexCandidate;
        } catch (e) {
          return sendError(res, 404, 'Not Found');
        }
      } else if (!stats.isFile()) {
        return sendError(res, 404, 'Not Found');
      }

      const targetHit = fileCache.get(target);
      if (targetHit) {
        return sendCached(req, res, targetHit);
      }

      fs.readFile(target, (readErr, data) => {
        if (aborted) return;
        if (readErr) {
          return sendError(res, 500, 'Internal Server Error');
        }
        const entry = {
          contentType: getMimeType(target),
          data,
        };
        fileCache.set(target, entry);
        sendCached(req, res, entry);
      });
    });
  });

  server.keepAliveTimeout = 60000;
  server.headersTimeout = 65000;

  server.on('clientError', (err, socket) => {
    if (err && err.code === 'ECONNRESET') return;
    if (socket && socket.writable && !socket.destroyed) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } else if (socket) {
      socket.destroy();
    }
  });

  server.on('connection', (socket) => {
    socket.setNoDelay(true);
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const addr = server.address();
      const port = addr.port;
      const url = `http://127.0.0.1:${port}/`;

      const close = () =>
        new Promise((resClose) => {
          server.close(() => resClose());
          for (const socket of sockets) {
            socket.destroy();
          }
          sockets.clear();
          fileCache.clear();
        });

      resolve({ url, port, close });
    });
  });
}

module.exports = {
  startStaticServer,
  MIME_TYPES,
};

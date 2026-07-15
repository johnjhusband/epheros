const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/data';
const DATA_FILE = path.join(DATA_DIR, 'invite-submissions.jsonl');
const PORT = process.env.PORT || 3002;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';

fs.mkdirSync(DATA_DIR, { recursive: true });

function notifyGitHubIssue(record) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return;
  const body = JSON.stringify({
    title: `Invite request — ${record.firm}`,
    body: [
      `**Name:** ${record.name}`,
      `**Email:** ${record.email}`,
      `**Firm:** ${record.firm}`,
      `**Portfolio / company size:** ${record.size || '_not provided_'}`,
      `**Current systems:** ${record.systems || '_not provided_'}`,
      `**Received:** ${record.received_at}`,
      '',
      '**Most expensive operational problem:**',
      record.problem,
    ].join('\n'),
    labels: ['invite-request'],
  });
  const req = https.request(
    {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/issues`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'epheros-invite-api',
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    },
    (res) => { res.resume(); }
  );
  req.on('error', (err) => console.error('GitHub notify failed:', err.message));
  req.write(body);
  req.end();
}

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  withCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/invite') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }

      const required = ['name', 'email', 'firm', 'problem'];
      const missing = required.filter((k) => !data[k] || !String(data[k]).trim());
      if (missing.length) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: `Missing: ${missing.join(', ')}` }));
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Invalid email address' }));
      }

      const record = {
        received_at: new Date().toISOString(),
        name: data.name,
        email: data.email,
        firm: data.firm,
        size: data.size || '',
        systems: data.systems || '',
        problem: data.problem,
      };

      fs.appendFile(DATA_FILE, JSON.stringify(record) + '\n', (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Storage error' }));
        }
        notifyGitHubIssue(record);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, () => console.log(`invite-api listening on ${PORT}`));

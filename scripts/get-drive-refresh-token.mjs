// One-time helper: obtains a Google Drive refresh token for the release
// upload script via the OAuth loopback flow.
//
// Prerequisite: an OAuth client of type "Desktop app" in the same Google
// Cloud project as the app's other OAuth clients, with its id/secret in
// .env.local as GDRIVE_OAUTH_CLIENT_ID / GDRIVE_OAUTH_CLIENT_SECRET.
//
// Usage: node scripts/get-drive-refresh-token.mjs
// Open the printed URL in a browser, approve with the Google account that
// owns the Drive folder, then copy the printed refresh token into .env.local.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const clientId = process.env.GDRIVE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GDRIVE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GDRIVE_OAUTH_CLIENT_ID and GDRIVE_OAUTH_CLIENT_SECRET in .env.local first.');
  process.exit(1);
}

const server = http.createServer();
server.listen(0, '127.0.0.1', () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}`;
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive',
      access_type: 'offline',
      prompt: 'consent',
    });
  console.log('Open this URL in a browser and approve access:\n');
  console.log(`  ${authUrl}\n`);

  server.on('request', async (req, res) => {
    const code = new URL(req.url, redirectUri).searchParams.get('code');
    if (!code) {
      res.end('No code in request.');
      return;
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    res.end('Done — you can close this tab and return to the terminal.');
    server.close();
    if (!tokens.refresh_token) {
      console.error('No refresh token returned:', JSON.stringify(tokens));
      process.exit(1);
    }
    console.log('Add this line to .env.local:\n');
    console.log(`  GDRIVE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  });
});

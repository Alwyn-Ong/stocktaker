// Uploads release artifacts into the Drive "Stock Taking > App > Latest" folder.
//
// Usage: node scripts/upload-release-to-drive.mjs <file> [<file>...]
//
// A file whose name already exists in the folder is updated in place (same
// Drive file id, so shared links keep working); otherwise it is created.
//
// Config, from the environment or .env.local:
//   GDRIVE_OAUTH_CLIENT_ID      OAuth "Desktop app" client id
//   GDRIVE_OAUTH_CLIENT_SECRET  its client secret
//   GDRIVE_OAUTH_REFRESH_TOKEN  from scripts/get-drive-refresh-token.mjs
//   GDRIVE_LATEST_FOLDER_ID     Drive folder id of App/Latest
//   RELEASE_VERSION             optional; stored as the Drive file description

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// Load .env.local for local runs; real env vars (e.g. CI secrets) win.
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const required = [
  'GDRIVE_OAUTH_CLIENT_ID',
  'GDRIVE_OAUTH_CLIENT_SECRET',
  'GDRIVE_OAUTH_REFRESH_TOKEN',
  'GDRIVE_LATEST_FOLDER_ID',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing config: ${missing.join(', ')} (set in .env.local or the environment)`);
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/upload-release-to-drive.mjs <file> [<file>...]');
  process.exit(1);
}
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.error(`No such file: ${f}`);
    process.exit(1);
  }
}

const MIME = {
  '.apk': 'application/vnd.android.package-archive',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
};

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GDRIVE_OAUTH_CLIENT_ID,
      client_secret: process.env.GDRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GDRIVE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function findExisting(token, name, folderId) {
  const q = `name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive search failed (${res.status}): ${await res.text()}`);
  return (await res.json()).files[0] ?? null;
}

function multipartBody(metadata, mimeType, content, boundary) {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, content, tail]);
}

async function upload(token, filePath) {
  const name = path.basename(filePath);
  const mimeType = MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream';
  const folderId = process.env.GDRIVE_LATEST_FOLDER_ID;
  const existing = await findExisting(token, name, folderId);

  const metadata = { name, mimeType };
  if (process.env.RELEASE_VERSION) metadata.description = `Release v${process.env.RELEASE_VERSION}`;
  if (!existing) metadata.parents = [folderId];

  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&supportsAllDrives=true`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';

  const boundary = `stocktaker-${Date.now()}`;
  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody(metadata, mimeType, fs.readFileSync(filePath), boundary),
  });
  if (!res.ok) throw new Error(`Upload of ${name} failed (${res.status}): ${await res.text()}`);
  const out = await res.json();
  console.log(`${existing ? 'Updated' : 'Created'} ${name} (https://drive.google.com/file/d/${out.id}/view)`);
}

const token = await getAccessToken();
for (const f of files) await upload(token, f);

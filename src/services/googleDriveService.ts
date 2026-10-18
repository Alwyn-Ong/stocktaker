import { getValidAccessToken } from './googleAuthService';

// Uploads a CSV file into the given Drive folder using a multipart upload.
export async function uploadCsvToFolder(
  folderId: string,
  fileName: string,
  csv: string,
): Promise<void> {
  const accessToken = await getValidAccessToken();

  const metadata = {
    name: fileName,
    mimeType: 'text/csv',
    parents: [folderId],
  };

  const boundary = `stocktaker-${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: text/csv\r\n\r\n' +
    `${csv}\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Drive access was not granted. Disconnect and reconnect Google in Settings to grant the updated Drive permission, then try again.',
      );
    }
    if (response.status === 404) {
      throw new Error(
        `The report folder could not be found (id: ${folderId}). Check the folder id and that your account can open it.`,
      );
    }
    throw new Error(`Failed to upload report to Drive. (HTTP ${response.status})${detail ? ` ${detail}` : ''}`);
  }
}

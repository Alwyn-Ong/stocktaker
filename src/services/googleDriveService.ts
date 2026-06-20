import { getValidAccessToken } from './googleAuthService';

export type DriveFile = {
  id: string;
  name: string;
};

export async function listCSVFiles(): Promise<DriveFile[]> {
  const accessToken = await getValidAccessToken();
  const query = encodeURIComponent("name contains '.csv' and trashed = false");
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to list Drive files: ${response.status}`);
  }

  const data = await response.json();
  return (data.files ?? []) as DriveFile[];
}

export async function downloadFile(fileId: string): Promise<string> {
  const accessToken = await getValidAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to download Drive file: ${response.status}`);
  }

  return response.text();
}

export async function uploadFile(fileId: string, content: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/csv',
      },
      body: content,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload Drive file: ${response.status}`);
  }
}

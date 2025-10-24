// Bootstrap once after login
import { ensureUserFolders } from './drive-sync.js';
import { getAccessToken } from './auth.js';

export async function bootstrapSync({ setMsg } = {}) {
  setMsg?.('Menyiapkan folder Bribox Kanpus…');
  const { root, pdfOrig, dataFolder } = await ensureUserFolders();
  console.log('[Drive] root:', root, 'pdf:', pdfOrig, 'data:', dataFolder, 'token:', !!getAccessToken());

  // (opsional) buat penanda kecil supaya kelihatan di Drive
  try {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: new Blob([
        `\r\n--314\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify({ name: '._bribox-setup-ok.txt', parents: [dataFolder] }) +
        `\r\n--314\r\nContent-Type: text/plain\r\n\r\n` +
        `setup ok at ${new Date().toISOString()}` +
        `\r\n--314--`
      ], { type: 'multipart/related; boundary=314' })
    });
  } catch (e) {
    console.warn('Gagal membuat penanda setup:', e);
  }

  setMsg?.('Selesai menyiapkan penyimpanan.');
}
// Google Drive helpers (folder structure + ensure files)
import { getAccessToken, requestDriveToken } from './auth.js';
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

async function fetchDrive(url, opts = {}) {
  if (!getAccessToken()) {
    // coba minta token dulu (silent), kalau belum pernah akan prompt saat login page
    await requestDriveToken();
  }
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) {
    const t = await res.text();
    const e = new Error(`Drive ${res.status}: ${t}`);
    e.status = res.status;
    throw e;
  }
  return res;
}

function mp(meta, blob){
  const b="-------314159265358979323846", d=`\r\n--${b}\r\n`, end=`\r\n--${b}--`;
  const m=new Blob([JSON.stringify(meta)], {type:'application/json'});
  return new Blob([d,"Content-Type: application/json; charset=UTF-8\r\n\r\n",m,d,`Content-Type: ${blob.type||'application/json'}\r\n\r\n`,blob,end]);
}

export async function ensureFolderByName(name, parent = null) {
  // cari dulu
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name.replace("'", "\\'")}' and trashed=false` +
    (parent ? ` and '${parent}' in parents` : '')
  );
  const listRes = await fetchDrive(`${API}/files?q=${q}&fields=files(id,name)`);
  const js = await listRes.json();
  if (js.files?.length) return js.files[0].id;

  // kalau belum ada → create folder metadata-only (bukan multipart)
  const meta = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parent ? { parents: [parent] } : {}),
  };
  const res = await fetchDrive(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  const created = await res.json();
  return created.id;
}

export async function ensureUserFolders(){
  const root = await ensureFolderByName("Bribox Kanpus");
  const pdfOrig = await ensureFolderByName("file pdf", root);
  const dataFolder = await ensureFolderByName("data", root);
  return { root, pdfOrig, dataFolder };
}

export async function deleteFile(fileId){
  const r = await fetchDrive(`${API}/files/${fileId}`, { method:'DELETE' });
  return r.status===204;
}
export async function listChildren(parentId){
  let out=[], token=null;
  do{
    const url=new URL(`${API}/files`);
    url.searchParams.set('q', `'${parentId}' in parents and trashed=false`);
    url.searchParams.set('fields', 'files(id,name,mimeType),nextPageToken');
    if (token) url.searchParams.set('pageToken', token);
    const js = await (await fetchDrive(url)).json();
    out.push(...(js.files||[])); token=js.nextPageToken||null;
  } while(token);
  return out;
}
export async function emptyFolder(folderId){
  const items = await listChildren(folderId);
  let ok=0, fail=0;
  for (const it of items){
    try{ await deleteFile(it.id); ok++; } catch{ fail++; }
  }
  return { ok, fail, total: items.length };
}

// === Upload PDF idempoten (simpen appProperties.sha256) ===
export async function findBySha256InFolder(folderId, sha256) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and appProperties has { key='sha256' and value='${sha256}' }`
  );
  const url = `${API}/files?q=${q}&fields=files(id,name,appProperties,modifiedTime,size)`;
  const js = await (await fetchDrive(url)).json();
  return js.files?.[0] || null;
}

export async function uploadPdfOriginal(file, { sha256, name }, folderIdOverride=null) {
  const { pdfOrig } = await ensureUserFolders();
  const parent = folderIdOverride || pdfOrig;

  // idempoten: kalau sudah ada, kembalikan id
  const exists = await findBySha256InFolder(parent, sha256);
  if (exists) return { id: exists.id, name: exists.name, sha256 };

  const meta = {
    name: name || file.name || `upload-${Date.now()}.pdf`,
    parents: [parent],
    mimeType: file.type || 'application/pdf',
    appProperties: { sha256 }
  };
  const boundary = 'gdrive314159';
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(meta),
    `\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/pdf'}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`
  ], { type: `multipart/related; boundary=${boundary}` });

  const res = await fetchDrive(
    `${UPLOAD}/files?uploadType=multipart&fields=id,name,appProperties`,
    { method: 'POST', body }
  );
  const js = await res.json();
  return { id: js.id, name: js.name, sha256 };
}

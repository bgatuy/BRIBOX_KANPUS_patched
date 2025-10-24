// Bootstrap once after login
import { ensureUserFolders } from './drive-sync.js';
export async function bootstrapSync({ setMsg }={}){
  setMsg?.('Menyiapkan folder…');
  await ensureUserFolders();
  setMsg?.('Selesai.');
}

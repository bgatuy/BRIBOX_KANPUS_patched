// Minimal Google Sign-In + token handling
export const AuthEvents = new EventTarget();
const LS_KEY = "GDRV_SESSION";
let tokenClient=null, accessToken=null;

export function getSession(){ try { return JSON.parse(localStorage.getItem(LS_KEY)||"null"); } catch { return null; } }
function setSession(s){ if(!s) localStorage.removeItem(LS_KEY); else localStorage.setItem(LS_KEY, JSON.stringify(s)); AuthEvents.dispatchEvent(new Event(s?'signin':'signout')); }
export function getAccessToken(){ return accessToken; }
export function requestDriveToken(forcePrompt = false) {
  return new Promise((resolve, reject) => {
    try {
      if (!tokenClient && window.google?.accounts?.oauth2) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: window.GOOGLE_CLIENT_ID,
          scope: window.GOOGLE_DRIVE_SCOPES || "https://www.googleapis.com/auth/drive.file",
          prompt: "",
          callback: (resp) => {
            if (resp?.access_token) {
              accessToken = resp.access_token;
              AuthEvents.dispatchEvent(new Event("token"));
              resolve(accessToken);
            } else {
              reject(new Error("No access token"));
            }
          },
        });
      }
      tokenClient?.requestAccessToken({ prompt: forcePrompt ? "consent" : "" });
    } catch (e) { reject(e); }
  });
}

function parseJwt(jwt){ try{ return JSON.parse(atob(jwt.split('.')[1])); }catch{return null;} }
function init(){
  const c=document.getElementById('gsi-btn');
  if (c && window.google?.accounts?.id){
    google.accounts.id.initialize({ client_id: window.GOOGLE_CLIENT_ID, callback: (resp)=>{ const p=parseJwt(resp.credential); if(p){ setSession({sub:p.sub,email:p.email,name:p.name,picture:p.picture}); } } });
    google.accounts.id.renderButton(c, { theme:'outline', size:'large', type:'standard', shape:'pill' });
  }
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

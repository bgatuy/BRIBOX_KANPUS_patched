// Namespaced localStorage per akun
import { getSession } from './auth.js';
function ns(){ const s=getSession(); return `AccountNS:${s?.sub||'anon'}:`; }
export const AccountStore = {
  get(k, d=null){ try{ const v=localStorage.getItem(ns()+k); return v==null?d:JSON.parse(v);}catch{return d;} },
  set(k, v){ localStorage.setItem(ns()+k, JSON.stringify(v)); },
  remove(k){ localStorage.removeItem(ns()+k); },
  keys(){ return Object.keys(localStorage).filter(x=>x.startsWith(ns())); }
};

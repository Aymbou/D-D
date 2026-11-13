/* Chroniques – service worker : permet d'ouvrir la table sans réseau.
   - La page (index.html) : réseau d'abord, pour toujours avoir la dernière version ;
     sans réseau, la dernière version enregistrée.
   - Icônes et manifeste : depuis la mémoire, mis à jour en arrière-plan.
   - Polices Google : depuis la mémoire si possible.
   - La table partagée (ntfy.sh) et tout le reste : jamais mis en mémoire. */
const CACHE = 'chroniques-v1';
const BASE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const avecDelai = (p, ms) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error('délai')), ms))]);

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if(r.method !== 'GET') return;
  // La page : réseau d'abord (5 s max), sinon la copie enregistrée
  if(r.mode === 'navigate' || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname))){
    e.respondWith(avecDelai(fetch(r), 5000).then(rep => {
      if(rep.ok){ const c = rep.clone(); caches.open(CACHE).then(k => k.put('./index.html', c)); }
      return rep;
    }).catch(() => caches.match('./index.html').then(m => m || caches.match('./'))));
    return;
  }
  // Fichiers du site et polices : mémoire d'abord, mise à jour en arrière-plan
  if(u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){
    e.respondWith(caches.open(CACHE).then(k => k.match(r).then(m => {
      const net = fetch(r).then(rep => { if(rep.ok || rep.type === 'opaque') k.put(r, rep.clone()); return rep; }).catch(() => m);
      return m || net;
    })));
  }
});

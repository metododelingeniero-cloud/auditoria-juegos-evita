// Guarda la app en el celular para que abra rápido y también sin señal (service worker).
// Se publica en GitHub al lado de index.html; la app lo registra al abrir.
//  - La página: primero intenta traer la última de GitHub, esperando como mucho ESPERA_MS. Si no hay señal o tarda, abre
//    la copia guardada; la descarga sigue por detrás y la próxima vez ya abre la nueva. Así las actualizaciones llegan igual.
//  - La fuente (Google Fonts): se baja una sola vez y después sale de la copia guardada.
//  - El script de Google (las auditorías) no pasa por acá: siempre va directo, nunca se guarda.
const CACHE = 'auditoria-juegos-evita-v1';
const PAGINA = './';
const ESPERA_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(PAGINA)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Si el navegador no deja guardar (almacenamiento bloqueado, modo privado), se va directo a la red: nunca deja la app sin abrir
  if (req.mode === 'navigate') { e.respondWith(paginaConRespaldo(req).catch(() => fetch(req))); return; }
  const host = new URL(req.url).hostname;
  if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') e.respondWith(guardadaPrimero(req).catch(() => fetch(req)));
});

async function paginaConRespaldo(req) {
  const cache = await caches.open(CACHE);
  const red = fetch(req).then(r => { if (r && r.ok) cache.put(PAGINA, r.clone()).catch(() => {}); return r; });
  try {
    const r = await Promise.race([red, new Promise(ok => setTimeout(() => ok(null), ESPERA_MS))]);
    if (r && r.ok) return r;
  } catch (_) {}
  const guardada = await cache.match(PAGINA);
  return guardada || red;                  // sin copia guardada todavía: se espera a la red
}

async function guardadaPrimero(req) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const r = await fetch(req);
  if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()).catch(() => {});
  return r;
}

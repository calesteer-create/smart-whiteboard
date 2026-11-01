import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Cache exactly this build's local files, relative to the Pages deployment scope.
function offlineShell(): Plugin {
  return {
    name: "offline-shell",
    apply: "build",
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(name => !name.endsWith(".map"));
      let hash = 0;
      for (const name of files.sort()) for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      this.emitFile({ type: "asset", fileName: "sw.js", source: `
const CACHE = 'smart-wb-shell-${hash}';
const FILES = ${JSON.stringify(['./', './index.html', ...files.map(f => './' + f)])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('smart-wb-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});` });
    },
  };
}
export default defineConfig({ base: "/smart-whiteboard/", plugins: [react(), offlineShell()], preview: { allowedHosts: true } });

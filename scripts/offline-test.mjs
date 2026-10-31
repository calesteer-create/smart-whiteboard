import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the actual built worker at the GitHub Pages base, without network after install.
const source = await readFile('dist/sw.js', 'utf8');
const scope = 'https://example.test/smart-whiteboard/';
const handlers = {};
const stores = new Map();
let online = true;
const url = request => new URL(typeof request === 'string' ? request : request.url, scope).href;
const network = async request => {
  if (!online) throw new Error('offline');
  return new Response(`resource ${url(request)}`);
};
const caches = {
  async open(name) {
    const entries = new Map(); stores.set(name, entries);
    return { async addAll(files) { for (const file of files) entries.set(url(file), await network(file)); } };
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); },
  async match(request) { for (const entries of stores.values()) if (entries.has(url(request))) return entries.get(url(request)).clone(); },
};
const self = { registration: { scope }, clients: { claim: async () => {} }, addEventListener: (name, handler) => { handlers[name] = handler; } };
vm.runInNewContext(source, { self, caches, fetch: network, Response, Promise });
let pending;
handlers.install({ waitUntil: promise => { pending = promise; } }); await pending;
handlers.activate({ waitUntil: promise => { pending = promise; } }); await pending;
online = false;
for (const path of ['', 'index.html']) {
  let response;
  handlers.fetch({ request: { method: 'GET', url: scope + path, mode: 'navigate' }, respondWith: promise => { response = promise; } });
  assert.equal((await response).status, 200, `offline ${path || 'root'}`);
}
const match = source.match(/\.\/assets\/index-[^" ]+\.js/);
assert.ok(match, 'precache includes JS');
let response;
handlers.fetch({ request: { method: 'GET', url: new URL(match[0], scope).href }, respondWith: promise => { response = promise; } });
assert.equal((await response).status, 200, 'offline JS');
console.log('Built service worker: offline root, index and JS served from cache.');

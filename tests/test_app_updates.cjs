const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../prototype/app-updates.js'), 'utf8');
const oldVersion = 'a'.repeat(40), newVersion = 'b'.repeat(40);
const stateKey = 'steadybee:update-state:/app.html';
const guardKey = 'steadybee:update-attempt:/app.html';

function browser(options = {}) {
  const store = options.store || new Map();
  const windowEvents = {}, documentEvents = {}, timeouts = new Map();
  let now = 1000000, nextId = 0, reloads = 0, requests = 0, interval, restored;
  const field = { id: 'A_age', type: 'number', tagName: 'INPUT', value: options.age || '60', checked: false };
  const document = {
    visibilityState: options.hidden ? 'hidden' : 'visible',
    querySelector: () => ({ content: options.current || oldVersion }),
    querySelectorAll: () => [field],
    getElementById: id => id === field.id ? field : null,
    addEventListener: (event, callback) => { documentEvents[event] = callback; }
  };
  const context = {
    document, navigator: { onLine: options.online !== false }, URL, AbortController,
    Date: class extends Date { static now() { return now; } },
    location: { pathname: '/app.html', href: 'https://steadybee.example/app.html', reload: () => { reloads++; } },
    addEventListener: (event, callback) => { windowEvents[event] = callback; },
    sessionStorage: {
      getItem: key => { if (options.blockStorage) throw Error('blocked'); return store.get(key) || null; },
      removeItem: key => { if (options.blockStorage) throw Error('blocked'); store.delete(key); },
      setItem: (key, value) => { if (options.blockStorage) throw Error('blocked'); store.set(key, value); }
    },
    snapshotSteadybeePlan: () => ({ planType: 'solo', dataLevel: 'hold', holdings: ['VGOV'], tab: 'plan' }),
    restoreSteadybeePlan: state => { restored = state; },
    setTimeout: (callback, ms) => { const id = ++nextId; timeouts.set(id, { callback, ms }); return id; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: (callback, ms) => { interval = { callback, ms }; },
    fetch: async (url, init) => {
      requests++;
      assert.equal(String(url), 'https://steadybee.example/version.json');
      assert.equal(init.cache, 'no-store');
      if (options.fail) throw Error('offline');
      return { ok: options.ok !== false, json: async () => ({ version: options.latest || oldVersion }) };
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    context, store, field, options, document, windowEvents, documentEvents,
    settle: () => new Promise(resolve => setImmediate(resolve)),
    advance: ms => { now += ms; },
    runPending: () => { const queued = [...timeouts.values()]; timeouts.clear(); queued.forEach(t => t.callback()); },
    get reloads() { return reloads; }, get requests() { return requests; },
    get interval() { return interval; }, get restored() { return restored; }
  };
}

test('the current deploy stays open and checks once per minute', async () => {
  const b = browser(); await b.settle();
  assert.equal(b.reloads, 0); assert.equal(b.requests, 1); assert.equal(b.interval.ms, 60000);
});

test('a new deploy reloads and restores inputs and the active plan once', async () => {
  const b = browser({ latest: newVersion, age: '44' }); await b.settle();
  assert.equal(b.reloads, 1);
  const fresh = browser({ current: newVersion, latest: newVersion, store: b.store }); await fresh.settle();
  assert.equal(fresh.field.value, '44');
  assert.equal(fresh.restored.planType, 'solo'); assert.equal(fresh.restored.tab, 'plan');
  assert.deepEqual(Array.from(fresh.restored.holdings), ['VGOV']);
  assert.equal(fresh.store.has(stateKey), false); assert.equal(fresh.reloads, 0);
});

test('returning to a visible web app checks for the latest deploy', async () => {
  const b = browser({ hidden: true, latest: newVersion }); await b.settle();
  assert.equal(b.requests, 0);
  b.document.visibilityState = 'visible'; b.documentEvents.visibilitychange(); await b.settle();
  assert.equal(b.reloads, 1);
});

test('reopen, focus, reconnect and the periodic check are registered', async () => {
  const b = browser(); await b.settle();
  for (const event of ['pageshow', 'focus', 'online']) {
    await b.windowEvents[event](); assert.equal(b.reloads, 0);
  }
  await b.interval.callback(); assert.equal(b.requests, 5);
});

test('a new deploy waits while the user is typing', async () => {
  const b = browser(); await b.settle();
  b.documentEvents.input(); b.options.latest = newVersion;
  await b.windowEvents.focus(); assert.equal(b.reloads, 0);
  b.advance(8050); b.runPending(); assert.equal(b.reloads, 1);
});

test('offline, failed and malformed responses never reload', async () => {
  for (const opts of [{ online: false }, { fail: true }, { ok: false }, { latest: 'invalid' }]) {
    const b = browser(opts); await b.settle(); assert.equal(b.reloads, 0);
  }
});

test('a failed cached reload cannot cause an infinite loop', async () => {
  const b = browser({ latest: newVersion, store: new Map([[guardKey, newVersion]]) });
  await b.settle(); assert.equal(b.reloads, 0);
});

test('blocked storage does not discard an edited plan', async () => {
  const b = browser({ blockStorage: true }); await b.settle();
  b.documentEvents.input(); b.advance(9000); b.options.latest = newVersion;
  await b.windowEvents.focus(); assert.equal(b.reloads, 0);
});

test('old temporary input snapshots are discarded', async () => {
  const store = new Map([[stateKey, JSON.stringify({ savedAt: 0, fields: [{ id: 'A_age', type: 'number', value: '44' }] })]]);
  const b = browser({ store }); await b.settle();
  assert.equal(b.field.value, '60'); assert.equal(store.has(stateKey), false);
});

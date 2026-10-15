/* Refresh installed web apps after a deploy; no service worker or offline cache. */
(function () {
  'use strict';
  var marker = document.querySelector('meta[name="steadybee-version"]');
  var currentVersion = marker && marker.content;
  var stateKey = 'steadybee:update-state:' + window.location.pathname;
  var guardKey = 'steadybee:update-attempt:' + window.location.pathname;
  var idleMs = 8000;
  var busy = false;
  var lastInteraction = 0;
  var dirty = false;
  var pendingTimer;

  function restore() {
    try {
      var raw = sessionStorage.getItem(stateKey);
      sessionStorage.removeItem(stateKey);
      if (!raw) return;
      var state = JSON.parse(raw);
      if (Date.now() - state.savedAt > 300000) return;
      state.fields.forEach(function (saved) {
        var field = document.getElementById(saved.id);
        if (!field || field.type !== saved.type) return;
        if (field.type === 'checkbox' || field.type === 'radio') field.checked = saved.checked;
        else if (field.tagName !== 'SELECT' || Array.from(field.options).some(function (o) { return o.value === saved.value; })) field.value = saved.value;
      });
      if (typeof window.restoreSteadybeePlan === 'function') window.restoreSteadybeePlan(state.plan);
      else if (typeof window.recompute === 'function') window.recompute();
      else if (typeof window.update === 'function') window.update();
    } catch (_) { /* Storage may be unavailable; never break the planner. */ }
  }

  function refresh(version) {
    if (document.visibilityState === 'hidden') return;
    var remaining = idleMs - (Date.now() - lastInteraction);
    if (remaining > 0) {
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(function () { refresh(version); }, remaining + 50);
      return;
    }
    try {
      if (sessionStorage.getItem(guardKey) === version) return;
      var fields = Array.from(document.querySelectorAll('input[id], select[id], textarea[id]'))
        .filter(function (field) { return field.type !== 'password' && field.type !== 'file'; })
        .map(function (field) { return { id: field.id, type: field.type, value: field.value, checked: field.checked }; });
      var plan = typeof window.snapshotSteadybeePlan === 'function' ? window.snapshotSteadybeePlan() : null;
      // A one-use snapshot stays in this tab and is deleted immediately after reload.
      sessionStorage.setItem(stateKey, JSON.stringify({ savedAt: Date.now(), fields: fields, plan: plan }));
      sessionStorage.setItem(guardKey, version);
    } catch (_) {
      // Do not erase an edited plan if the browser prevents temporary restoration.
      if (dirty) return;
    }
    window.location.reload();
  }

  async function check() {
    if (busy || document.visibilityState === 'hidden' || navigator.onLine === false) return;
    busy = true;
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await fetch(new URL('version.json', window.location.href), {
        cache: 'no-store', credentials: 'same-origin', signal: controller.signal
      });
      if (!response.ok) return;
      var deployment = await response.json();
      if (/^[a-f0-9]{40,64}$/.test(deployment.version) && deployment.version !== currentVersion) refresh(deployment.version);
    } catch (_) { /* Offline/failed checks leave the current page usable. */ }
    finally { clearTimeout(timeout); busy = false; }
  }

  restore();
  if (!currentVersion || currentVersion === 'development') return;
  document.addEventListener('input', function () { dirty = true; lastInteraction = Date.now(); }, true);
  document.addEventListener('change', function () { dirty = true; lastInteraction = Date.now(); }, true);
  document.addEventListener('keydown', function () { lastInteraction = Date.now(); }, true);
  document.addEventListener('pointerdown', function () { lastInteraction = Date.now(); }, true);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  setInterval(check, 60000);
  check();
})();

# Browser APIs

## Contents

- [Service Workers](#service-workers)
- [Web Workers](#web-workers)
- [IndexedDB](#indexeddb)
- [Intersection Observer](#intersection-observer)
- [Resize Observer](#resize-observer)
- [Performance APIs](#performance-apis)
- [Web Crypto](#web-crypto)
- [View Transitions API](#view-transitions-api)
- [Navigation API](#navigation-api)
- [Speculation Rules API](#speculation-rules-api)
- [Popover API](#popover-api)
- [CloseWatcher](#closewatcher)
- [Scheduler API](#scheduler-api)
- [Other APIs](#other-apis)

---

## Service Workers

### Registration and Lifecycle

```typescript
// Register — main thread
if ("serviceWorker" in navigator) {
  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    type: "module",     // ES modules in service worker
    updateViaCache: "none",
  });

  // Check for updates periodically
  setInterval(() => reg.update(), 60 * 60 * 1000);
}
```

### Caching Strategies

One `fetch` handler routes each request to one strategy. Do not register several handlers that each call `respondWith` for the same request: the second call throws `InvalidStateError`.

```typescript
const CACHE_VERSION = "v2";
const STATIC_ASSETS = ["/", "/styles.css", "/app.js", "/offline.html"];

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)));
  // self.skipWaiting() only when the new worker is compatible with pages that loaded under the old one
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  // self.clients.claim() has the same compatibility caveat
});

self.addEventListener("fetch", (event: FetchEvent) => {
  const req = event.request;
  if (req.method !== "GET") return;                       // never cache writes; let the browser handle them
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    // Network first, offline fallback
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html") as Promise<Response>));
  } else if (url.pathname.startsWith("/assets/")) {
    // Cache first for hashed assets
    event.respondWith(caches.match(req).then((hit) => hit ?? fetchAndCache(event, req)));
  } else {
    // Stale-while-revalidate for the rest
    event.respondWith(
      caches.match(req).then((hit) => {
        const refresh = fetchAndCache(event, req);
        event.waitUntil(refresh.catch(() => {}));         // keep the worker alive until the cache write finishes
        return hit ?? refresh;
      })
    );
  }
});

async function fetchAndCache(event: FetchEvent, req: Request): Promise<Response> {
  const res = await fetch(req);
  if (res.ok) {                                            // do not store error responses
    const copy = res.clone();
    event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.put(req, copy)));
  }
  return res;
}
```

Update flow: `skipWaiting()` plus `clients.claim()` swaps a worker under open pages, which breaks pages that expect the old cache layout or message format. The safer default is to let the new worker wait, tell the page an update is ready, and activate on user confirmation or next navigation. Serve `sw.js` with `Cache-Control: no-cache` (see [http-patterns.md](http-patterns.md#service-worker-script-caching)).

---

## Web Workers

```typescript
// Dedicated Worker — CPU-intensive off main thread
// worker.ts
self.onmessage = (e: MessageEvent<{ data: number[] }>) => {
  const result = heavyComputation(e.data.data);
  self.postMessage(result);
};

// main.ts
const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
worker.postMessage({ data: largeArray });
worker.onmessage = (e) => console.log("Result:", e.data);
worker.onerror = (e) => console.error("Worker error:", e);

// Transferable objects — zero-copy transfer
const buffer = new ArrayBuffer(1024 * 1024);
worker.postMessage({ buffer }, [buffer]);  // buffer is now empty in main thread

// SharedArrayBuffer — shared memory (requires cross-origin isolation)
const shared = new SharedArrayBuffer(1024);
const view = new Int32Array(shared);
worker.postMessage({ shared });
// Both threads can read/write via Atomics
Atomics.store(view, 0, 42);
Atomics.notify(view, 0);
```

### Comlink — Simplified Worker Communication

Use [Comlink](https://github.com/GoogleChromeLabs/comlink) for RPC-style worker communication: `expose(api)` in the worker, `wrap<typeof api>(worker)` in main thread. Calls become `await api.method(args)` — no manual `postMessage`/`onmessage`.

---

## IndexedDB

```typescript
// Open database with versioned schema
function openDB(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("users")) {
        const store = db.createObjectStore("users", { keyPath: "id" });
        store.createIndex("email", "email", { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// CRUD: use db.transaction("store", "readwrite").objectStore("store").add/put/get/delete
// Cursors: store.openCursor() for iterating large datasets with filtering
// getAllRecords(): batch read with primary keys in batches
```

**Tip:** Use [idb](https://github.com/jakearchibald/idb) library for Promise-based wrapper over IndexedDB.

---

## Intersection Observer

```typescript
// Lazy loading images / infinite scroll
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        img.src = img.dataset.src!;
        observer.unobserve(img);
      }
    }
  },
  {
    root: null,                // viewport
    rootMargin: "200px",       // start loading 200px before visible
    threshold: 0,              // trigger as soon as any pixel is visible
  }
);

document.querySelectorAll("img[data-src]").forEach((img) => observer.observe(img));

// Scroll-triggered animations: toggle "visible" class with { threshold: 0.1 }
```

---

## Resize Observer

```typescript
// Respond to element size changes — not just viewport
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { inlineSize, blockSize } = entry.contentBoxSize[0];
    const element = entry.target as HTMLElement;

    // Component-level responsive behavior
    element.classList.toggle("compact", inlineSize < 400);
    element.classList.toggle("expanded", inlineSize > 800);
  }
});

observer.observe(document.querySelector(".responsive-widget")!);

// Cleanup
observer.disconnect();
```

---

## Performance APIs

```typescript
// Performance marks and measures
performance.mark("fetch-start");
const data = await fetch("/api/data");
performance.mark("fetch-end");
performance.measure("fetch-duration", "fetch-start", "fetch-end");

const measure = performance.getEntriesByName("fetch-duration")[0];
console.log(`Fetch took ${measure.duration.toFixed(2)}ms`);

// Core Web Vitals field measurement (LCP, INP, CLS): see the performance skill.
// PerformanceObserver is the underlying mechanism, e.g.:
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) report(entry);
}).observe({ type: "largest-contentful-paint", buffered: true });

// Long task detection: observe({ type: "longtask" }), log entries > 50ms
// Navigation timing: getEntriesByType("navigation")[0] for TTFB, domInteractive, domComplete
```

---

## Web Crypto

Use `crypto.subtle` and `crypto.getRandomValues` for hashing and randomness in the browser, and `crypto.randomUUID()` for identifiers. Choosing algorithms, key handling, and what not to build yourself: `security`.

---

## View Transitions API

### Same-Document Transitions (SPA)

```typescript
// Basic transition
document.startViewTransition(async () => {
  updateDOM();  // modify the DOM
});

// Typed transition — CSS selects animation based on type
document.startViewTransition({
  update: () => updateDOM(),
  types: ["slide-left"],
});
```

### Cross-Document Transitions (MPA)

```css
/* Opt in via CSS — no JavaScript needed */
@view-transition {
  navigation: auto;
}

/* Name elements for targeted transitions */
.card { view-transition-name: card-1; }

/* Auto-naming — browser generates names from element identity */
.card { view-transition-name: match-element; }

/* Group snapshots with shared class for bulk styling */
.card { view-transition-class: card; }

/* Customize transition animations */
::view-transition-old(root) { animation: fade-out 0.3s; }
::view-transition-new(root) { animation: fade-in 0.3s; }

/* Conditional styling based on active transition */
:active-view-transition {
  /* styles applied only during a view transition */
}
```

### Level 2 Features

Same-document transitions are the broadly available core (Baseline since Firefox 144 in October 2025, after Chrome and Safari 18). The Level 2 additions ship unevenly, so treat them as progressive enhancement.

- **`view-transition-class`**: style groups of snapshots without individual names
- **`view-transition-name: match-element`**: auto-naming based on element identity
- **`:active-view-transition`**: selector active during transitions
- **Scoped transitions** (experimental, Chromium only so far): `element.startViewTransition()` for subtree transitions
- Cross-document transitions pair with Speculation Rules for instant multi-page navigations

Honor `prefers-reduced-motion` by shortening or disabling the animations.

---

## Navigation API

```typescript
// Replacement for history.pushState / popstate (Baseline newly available since January 2026; older browsers lack it)
navigation.addEventListener("navigate", (event: NavigateEvent) => {
  if (!event.canIntercept) return;

  event.intercept({
    handler: async () => {
      const content = await fetchPage(event.destination.url);
      document.querySelector("main")!.innerHTML = content;
    },
  });
});

// Programmatic navigation
navigation.navigate("/new-page", { state: { from: "dashboard" } });

// Access navigation entries
const entries = navigation.entries();
const current = navigation.currentEntry;
console.log(current.url, current.getState());

// Back/forward with traverseTo
await navigation.traverseTo(entries[2].key);
```

Advantages over History API: event-based interception, abort signal support, navigation state per entry, async handler completion tracking.

---

## Speculation Rules API

```html
<!-- Prerender pages the user is likely to visit -->
<script type="speculationrules">
{
  "prerender": [
    {
      "where": { "href_matches": "/products/*" },
      "eagerness": "moderate"
    }
  ],
  "prefetch": [
    {
      "where": { "selector_matches": "a[href^='/blog/']" },
      "eagerness": "conservative"
    }
  ]
}
</script>
```

| Eagerness | Behavior | Use for |
|-----------|----------|---------|
| `immediate` | Speculate as soon as rules are observed | Near-certain navigations (CTA buttons) |
| `eager` | Desktop: 10ms hover. Mobile: viewport heuristics (50ms after entering viewport) | Likely navigations |
| `moderate` | Desktop: 200 ms hover or pointerdown, whichever comes first. Mobile: viewport heuristics (after scrolling stops) | Probable navigations |
| `conservative` | Pointerdown or touchstart only | Less certain navigations |

Chrome and Edge ship it, Firefox does not, and Safari keeps it behind a flag: treat it as progressive enhancement that does nothing elsewhere. It supersedes the legacy `<link rel="prerender">` hint (Chromium treats the old hint as a prefetch). Works with cross-document View Transitions. Browsers cap concurrent speculations. Use the `Speculation-Rules` HTTP header for dynamic rules; document rules (`where`) apply site-wide.

**Prerender hazard:** a prerendered page runs its JavaScript and loads subresources before the user navigates. Analytics, side-effecting GET handlers, personalized state, and ad impressions fire early. Gate them on `document.prerendering` and wait for the `prerenderingchange` event:

```typescript
function whenVisible(fn: () => void) {
  if (document.prerendering) document.addEventListener("prerenderingchange", fn, { once: true });
  else fn();
}
whenVisible(() => analytics.pageView());
```

Prefer `prefetch` for authenticated or personalized pages; prerender only content that is safe to render before the user asks for it.

---

## Popover API

```html
<!-- Declarative — no JavaScript needed -->
<button popovertarget="menu">Open Menu</button>
<div id="menu" popover>
  <p>Menu content — renders in top layer, above all other content</p>
</div>

<!-- Manual popover — no light dismiss -->
<div id="panel" popover="manual">Stays open until explicitly closed</div>

<!-- Hint popover — subordinate to auto popovers (tooltip-like). Not Baseline: Chromium and Firefox only; Safari lacks it -->
<div id="tip" popover="hint">Tooltip text</div>
```

```typescript
// Programmatic control
const popover = document.getElementById("menu")!;
popover.showPopover();
popover.hidePopover();
popover.togglePopover();

// Events
popover.addEventListener("toggle", (e: ToggleEvent) => {
  console.log(e.oldState, "→", e.newState);  // "closed" → "open"
});
```

**What it gives you:** top-layer rendering (no z-index), light dismiss and Escape for `popover="auto"`, and automatic invoker-to-popover wiring. **What it does not give you:** a focus trap, an inert background, or menu semantics. Use a popover for non-modal top-layer UI; a menu still needs its own ARIA pattern and keyboard handling (see `accessibility`). Use `<dialog>` with `showModal()` for modal UI. The `closedby` attribute belongs to `<dialog>`, not popovers.

---

## CloseWatcher

```typescript
// Respond to platform close gestures (Escape key, Android back button)
const watcher = new CloseWatcher();

watcher.addEventListener("cancel", (e) => {
  // Optionally prevent close (e.g., unsaved changes)
  if (hasUnsavedChanges) e.preventDefault();
});

watcher.addEventListener("close", () => {
  closeMyUI();
});

// Destroy when UI element is removed
watcher.destroy();
```

Built into `<dialog>` and the Popover API. Use CloseWatcher directly for custom UI (drawers, panels) that needs platform close gestures. Safari does not ship it (Chrome and Firefox do): feature-detect `"CloseWatcher" in window` and keep an Escape-key handler as the fallback.

---

## Scheduler API

```typescript
// Defer non-critical work — keep main thread responsive
const controller = new TaskController({ priority: "background" });

scheduler.postTask(
  () => analytics.flush(),
  { signal: controller.signal, priority: "background" }
);

// Priority levels: "user-blocking" > "user-visible" > "background"

// Yield to the browser between long tasks
async function processItems(items: Item[]) {
  for (const item of items) {
    process(item);
    await yieldToMain();      // let the browser handle events and rendering
  }
}

// Abort scheduled task
controller.abort();
```

`scheduler.yield()` continues the task at high priority after the browser handles pending input and rendering. Chrome and Firefox ship it, Safari does not: feature-detect it and fall back to a macrotask yield.

```typescript
const yieldToMain = () =>
  "scheduler" in globalThis && "yield" in scheduler
    ? scheduler.yield()
    : new Promise<void>((resolve) => setTimeout(resolve));
```

---

## Other APIs

```typescript
// Clipboard API
await navigator.clipboard.writeText("copied text");
const text = await navigator.clipboard.readText();

// Share API (mobile)
if (navigator.canShare?.({ title: "Title", url: location.href })) {
  await navigator.share({ title: "Title", text: "Description", url: location.href });
}

// Broadcast Channel — cross-tab communication
const channel = new BroadcastChannel("auth");
channel.postMessage({ type: "logout" });
channel.onmessage = (e) => { if (e.data.type === "logout") window.location.href = "/login"; };

// Notification API
const permission = await Notification.requestPermission();
if (permission === "granted") {
  new Notification("Title", { body: "Message", icon: "/icon.png" });
}

// Storage quota estimation
const estimate = await navigator.storage.estimate();
console.log(`Using ${estimate.usage} of ${estimate.quota} bytes`);
await navigator.storage.persist();  // request persistent storage
```

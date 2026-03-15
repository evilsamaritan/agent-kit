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

```typescript
// sw.js — Cache First with version
const CACHE_VERSION = "v2";
const STATIC_ASSETS = ["/", "/styles.css", "/app.js", "/offline.html"];

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();  // Activate immediately
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();  // Take control of all clients
});

// Stale-While-Revalidate
self.addEventListener("fetch", (event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        return response;
      });
      return cached || fetched;
    })
  );
});

// Network First with offline fallback
self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")!)
    );
  }
});
```

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

// Web Vitals observation
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    switch (entry.entryType) {
      case "largest-contentful-paint":
        console.log("LCP:", entry.startTime);
        break;
      case "event":
        const inp = entry as PerformanceEventTiming;
        console.log("INP candidate:", inp.duration);
        break;
      case "layout-shift":
        if (!(entry as any).hadRecentInput) {
          console.log("CLS shift:", (entry as any).value);
        }
        break;
    }
  }
});

observer.observe({ type: "largest-contentful-paint", buffered: true });
observer.observe({ type: "event", buffered: true, durationThreshold: 16 });
observer.observe({ type: "layout-shift", buffered: true });

// Long task detection: observe({ type: "longtask" }), log entries > 50ms
// Navigation timing: getEntriesByType("navigation")[0] for TTFB, domInteractive, domComplete
```

---

## Web Crypto

```typescript
// Hash a string
async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generate AES-GCM key
const key = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,     // extractable
  ["encrypt", "decrypt"]
);

// Encrypt
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  key,
  new TextEncoder().encode("secret data")
);

// Decrypt
const decrypted = await crypto.subtle.decrypt(
  { name: "AES-GCM", iv },
  key,
  encrypted
);
const text = new TextDecoder().decode(decrypted);

// Generate UUID
const id = crypto.randomUUID();
```

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

### Level 2 Features (Baseline)

- **`view-transition-class`** — style groups of snapshots without individual names
- **`view-transition-name: match-element`** — auto-naming based on element identity
- **`:active-view-transition`** — selector active during transitions
- **Scoped transitions** (experimental) — `element.startViewTransition()` on any HTMLElement for subtree transitions
- Cross-document transitions work with Speculation Rules for instant MPA navigations

---

## Navigation API

```typescript
// Modern replacement for history.pushState / popstate (Baseline — all browsers)
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
| `moderate` | Hover (desktop) or pointerdown (mobile) | Probable navigations |
| `conservative` | Pointerdown or touchstart only | Less certain navigations |

**Replaces `<link rel="prerender">`** (deprecated). Works with cross-document View Transitions. Browser limits concurrent prerenders (~10 in Chrome). Use `Speculation-Rules` HTTP header for dynamic rules. Document rules (`where`) apply site-wide without per-page configuration.

---

## Popover API

```html
<!-- Declarative — no JavaScript needed -->
<button popovertarget="menu">Open Menu</button>
<div id="menu" popover>
  <p>Menu content — renders in top layer, above all other content</p>
</div>

<!-- Manual popover — no light dismiss -->
<div id="dialog" popover="manual">Stays open until explicitly closed</div>

<!-- Hint popover — subordinate to auto popovers (tooltips) -->
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

**Key benefits:** top-layer rendering (no z-index), built-in light dismiss for `popover="auto"`, accessible by default, `closedby` attribute controls dismiss behavior. Replaces custom modal/dropdown stacking logic.

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

Built into `<dialog>` and Popover API automatically. Use CloseWatcher directly for custom UI elements (drawers, panels, custom modals) that need platform close gesture support.

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
    await scheduler.yield();  // let browser handle events and rendering
  }
}

// Abort scheduled task
controller.abort();
```

Use `scheduler.yield()` instead of `setTimeout(fn, 0)` — it preserves task priority and is integrated with the browser's event loop.

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

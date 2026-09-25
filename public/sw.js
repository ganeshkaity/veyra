// Veyra Service Worker (TWA & PWA Support)
const CACHE_NAME = "veyra-cache-v3";
const STATIC_ASSETS = [
  "/",
  "/chat",
  "/manifest.json",
  "/favicon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-512x512.png"
];

// Install: Cache critical static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// Activate: Remove outdated caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-first for dynamic navigation, cache-first for static icons/assets
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Bypass non-GET requests or Firebase / API calls
  if (
    request.method !== "GET" ||
    url.origin.includes("firestore.googleapis.com") ||
    url.origin.includes("identitytoolkit.googleapis.com") ||
    url.origin.includes("firebasestorage.googleapis.com") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Static assets (images, icons, fonts): Stale-While-Revalidate
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Navigation requests: Network first with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((matching) => {
          return matching || caches.match("/chat");
        });
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Push notification support
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || "Veyra";
    const options = {
      body: data.body || "New message received",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: data.url || "/chat",
      vibrate: [100, 50, 100],
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Push error:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || "/chat";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

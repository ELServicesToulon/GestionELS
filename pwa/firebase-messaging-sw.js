importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// TODO: inject firebaseConfig via importScripts('./firebase-config.js') if hosted; placeholder for build step.
self.addEventListener('install', () => {
  // no-op
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || event.notification?.data?.click_action;
  if (!url) {
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const matching = clientsArr.find((client) => client.url.includes(url));
      if (matching) {
        matching.focus();
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }
  const payload = event.data.json();
  const notification = payload.notification || { title: 'Livraison', body: 'Nouvelle fiche disponible' };
  const data = payload.data || {};
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      data,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png'
    })
  );
});

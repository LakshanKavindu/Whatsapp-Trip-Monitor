importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");
importScripts("firebase-config.js?v=7");

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || payload.data || {};
  self.registration.showNotification(notification.title || "New trip", {
    body: notification.body || "A matching trip is available",
    icon: "/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});

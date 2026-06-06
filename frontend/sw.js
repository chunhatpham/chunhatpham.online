self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: data.icon || 'https://i.postimg.cc/BZTQdwdb/56575EA9-6C1E-453E-A0EE-628BF972D3E7.png',
            badge: 'https://i.postimg.cc/BZTQdwdb/56575EA9-6C1E-453E-A0EE-628BF972D3E7.png',
            image: data.image || null,
            vibrate: [200, 100, 200],
            data: { url: data.url || '/' } // URL để mở khi click vào thông báo
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'ChuNhatPham', options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
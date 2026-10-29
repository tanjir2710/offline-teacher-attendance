// Sensitive API responses are never cached. Calendar alarms work through your calendar app.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window'}).then(clients=>{if(clients[0])return clients[0].focus();return self.clients.openWindow('/')}))});

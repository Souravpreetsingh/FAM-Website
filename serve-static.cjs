const http = require('http');
const fs = require('fs');
const path = require('path');
const publicDir = path.join(process.cwd(), 'public');
const port = Number(process.env.PORT) || 5174;
const mimes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const devServiceWorker = `
self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  var hadCaches = false;

  event.waitUntil(
    caches.keys()
      .then(function(names) {
        hadCaches = names.length > 0;
        return Promise.all(names.map(function(name) { return caches.delete(name); }));
      })
      .then(function() { return self.clients.claim(); })
      .then(function() { return self.clients.matchAll({ type: 'window', includeUncontrolled: true }); })
      .then(function(clients) {
        if (!hadCaches) return;
        clients.forEach(function(client) {
          if (client.url) client.navigate(client.url);
        });
      })
      .then(function() { return self.registration.unregister(); })
  );
});
`;
http.createServer((req, res) => {
  var urlPath = req.url.split('?')[0].split('#')[0];
  if (urlPath === '/') {
    res.writeHead(302, {
      'Location': '/index.html?fresh=' + Date.now(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end();
    return;
  }
  if (urlPath === '/__clear-cache') {
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Clear-Site-Data': '"cache", "storage"'
    });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Local Cache Cleared</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #f8f4ec; color: #1a1c1a; }
    main { max-width: 520px; padding: 32px; text-align: center; }
    a { color: #0a341d; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>Local cache cleared</h1>
    <p>This local preview cleared cached site data for this origin.</p>
    <p><a href="/">Open the current site</a></p>
  </main>
  <script>
  Promise.all([
    'caches' in window ? caches.keys().then(function(names) {
      return Promise.all(names.map(function(name) { return caches.delete(name); }));
    }) : Promise.resolve(),
    'serviceWorker' in navigator && navigator.serviceWorker.getRegistrations
      ? navigator.serviceWorker.getRegistrations().then(function(registrations) {
          return Promise.all(registrations.map(function(registration) { return registration.unregister(); }));
        })
      : Promise.resolve()
  ]).then(function() {
    setTimeout(function() { window.location.replace('/?fresh=' + Date.now()); }, 500);
  });
  </script>
</body>
</html>`);
    return;
  }
  if (urlPath === '/sw.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(devServiceWorker);
    return;
  }
  if (urlPath === '/manifest.json') {
    res.writeHead(204);
    res.end();
    return;
  }
  let filePath = path.join(publicDir, urlPath === '/' ? 'index.html' : urlPath);
  filePath = path.normalize(filePath);
  if (!filePath.startsWith(publicDir)) { res.writeHead(403); res.end(); return; }
  
  let ext = path.extname(filePath).toLowerCase();
  if (!ext) {
    let htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath)) { filePath = htmlPath; ext = '.html'; }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('File not found'); return; }
    res.writeHead(200, {
      'Content-Type': mimes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
}).listen(port, () => console.log('Static site at http://localhost:' + port));

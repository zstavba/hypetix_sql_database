// Minimal Node.js server for cPanel environment testing
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from minimal Node.js server!\n');
});

server.listen(0, function () {
  const address = server.address();
  const actualPort = address && address.port ? address.port : 'unknown';
  console.log('Minimal server running on port ' + actualPort);
});

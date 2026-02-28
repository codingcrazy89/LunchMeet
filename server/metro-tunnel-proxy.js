const http = require("http");
const net = require("net");

const METRO = { host: "127.0.0.1", port: 8081 };
const LISTEN_PORT = 8082;

const server = http.createServer((clientReq, clientRes) => {
  const opts = {
    hostname: METRO.host,
    port: METRO.port,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: `${METRO.host}:${METRO.port}` },
  };

  const proxyReq = http.request(opts, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message);
    clientRes.writeHead(502);
    clientRes.end("Metro not ready");
  });

  clientReq.pipe(proxyReq, { end: true });
});

server.on("upgrade", (req, clientSocket, head) => {
  const metroSocket = net.connect(METRO.port, METRO.host, () => {
    const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
    const headers = Object.entries({ ...req.headers, host: `${METRO.host}:${METRO.port}` })
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    metroSocket.write(reqLine + headers + "\r\n\r\n");
    if (head.length) metroSocket.write(head);
    metroSocket.pipe(clientSocket);
    clientSocket.pipe(metroSocket);
  });
  metroSocket.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => metroSocket.destroy());
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`Metro tunnel proxy :${LISTEN_PORT} -> Metro :${METRO.port}`);
});

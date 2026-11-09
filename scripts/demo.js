/* eslint-disable no-console -- command-line tool */
// `npm run demo`: serves the repository's files, so that the page in
// packages/codemirror-blocks/demo can load the built files (`npm run bundle`).
// `--port N` for a port other than 8080.
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = process.argv.indexOf("--port");
const port = at >= 0 ? Number(process.argv[at + 1]) : 8080;
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".rkt": "text/plain",
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
    // (only inside the repository)
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
        "Content-Length": data.length,
        "Cache-Control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  })
  .listen(port, () => {
    console.log(
      `http://localhost:${port}/packages/codemirror-blocks/demo/  (the built files: npm run bundle)`
    );
  });

// A tiny static server for the demo (port 8177). Started and stopped by playwright.config.ts.
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "demo");
const types = { ".html": "text/html", ".js": "text/javascript", ".map": "application/json" };
http
  .createServer((req, res) => {
    const name = req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0];
    const file = path.join(root, path.normalize(name));
    if (!file.startsWith(root) || !fs.existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(8177, "127.0.0.1");

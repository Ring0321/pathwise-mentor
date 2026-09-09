import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryEdgeStore } from "../cloud/edge-api-store.mjs";
import { createSeedWorkbench } from "../cloud/workbench-domain.mjs";
import worker from "../cloud/edge-api-worker.mjs";

// Local acceptance only. This file is not included in deployment artifacts.
const root = fileURLToPath(new URL("../../sepath-yudao-teacher-console/dist/", import.meta.url));
const store = createMemoryEdgeStore();
await store.ensureWorkbench(createSeedWorkbench());
const env = {
  SEPATH_STORE: store, SEPATH_PRIVACY_MODE: "pseudonymous",
  SEPATH_AUTH_SECRET: "local-agent-acceptance-signing-only",
  SEPATH_TEACHER_ACCESS_CODE: "local-agent-acceptance",
};
const port = Number(process.env.PORT || 5197);
const mime = { ".html": "text/html;charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg" };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const result = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, ...(body.length ? { body } : {}) }), env);
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    const path = resolve(root, "." + decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!path.startsWith(root.replace(/[\\/]+$/, "") + sep)) { res.writeHead(403); res.end(); return; }
    const asset = await readFile(path);
    res.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(asset);
  } catch { res.writeHead(404); res.end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Agent acceptance listening at http://127.0.0.1:${port}`));

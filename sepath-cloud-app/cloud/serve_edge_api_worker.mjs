import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import worker from "./edge-api-worker.mjs";
import { createMemoryEdgeStore } from "./edge-api-store.mjs";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(MODULE_DIR, "..");

function readJsonFile(filePath) {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeJsonFile(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");
  renameSync(tempPath, filePath);
}

function createFileBackedStore(filePath) {
  const absolutePath = resolve(filePath);
  const saved = readJsonFile(absolutePath);
  const initialState = saved.state && typeof saved.state === "object" ? saved.state : saved;
  return createMemoryEdgeStore({
    mode: "file-edge-store.v1",
    initialState,
    onChange(state) {
      writeJsonFile(absolutePath, {
        runtime: "sepath-file-edge-store.v1",
        updatedAt: new Date().toISOString(),
        state,
      });
    },
  });
}

export function createDefaultEdgeApiEnv() {
  return {
    SEPATH_DEPLOY_ENV: process.env.SEPATH_DEPLOY_ENV || "",
    SEPATH_PRIVACY_MODE: process.env.SEPATH_PRIVACY_MODE || "pseudonymous",
    SEPATH_AUTH_SECRET: process.env.SEPATH_AUTH_SECRET || "",
    SEPATH_TEACHER_ACCESS_CODE: process.env.SEPATH_TEACHER_ACCESS_CODE || "",
    SEPATH_TOKEN_ISSUER_SECRET: process.env.SEPATH_TOKEN_ISSUER_SECRET || "",
    SEPATH_RETURN_SECRET: process.env.SEPATH_RETURN_SECRET || "",
    SEPATH_GITHUB_WEBHOOK_SECRET: process.env.SEPATH_GITHUB_WEBHOOK_SECRET || "",
    SEPATH_GITHUB_WEBHOOK_TOKEN: process.env.SEPATH_GITHUB_WEBHOOK_TOKEN || "",
    SEPATH_ALLOWED_ORIGINS: process.env.SEPATH_ALLOWED_ORIGINS || "",
    LLM_BASE_URL: process.env.LLM_BASE_URL || "",
    LLM_API_KEY: process.env.LLM_API_KEY || "",
    LLM_MODEL: process.env.LLM_MODEL || "",
    SEPATH_STORE: createFileBackedStore(
      process.env.SEPATH_DATA_FILE || resolve(APP_ROOT, "data/sepath-edge-store.json"),
    ),
  };
}

function toHeaders(rawHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }
  return headers;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

export function createEdgeApiServer(env = createDefaultEdgeApiEnv()) {
  return createServer(async (req, res) => {
    try {
      const host = req.headers.host || "127.0.0.1";
      const url = new URL(req.url || "/", `http://${host}`);
      const method = req.method || "GET";
      const hasBody = method !== "GET" && method !== "HEAD";
      const request = new Request(url, {
        method,
        headers: toHeaders(req.headers),
        body: hasBody ? await readBody(req) : undefined,
      });
      const response = await worker.fetch(request, env);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.writeHead(response.status);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "edge_api_server_error", message: error.message }));
    }
  });
}

function readPort(argv) {
  const index = argv.indexOf("--port");
  if (index >= 0 && argv[index + 1]) return Number(argv[index + 1]);
  return Number(process.env.PORT || 8787);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const host = process.env.HOST || "127.0.0.1";
  const server = createEdgeApiServer();
  server.listen(readPort(process.argv), host, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : readPort(process.argv);
    console.log(JSON.stringify({ runtime: "sepath-edge-api.v1", status: "listening", url: `http://${host}:${port}` }));
  });
}

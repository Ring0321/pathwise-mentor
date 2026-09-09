import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import worker from "./llm-gateway-worker.mjs";
import { createMemoryEdgeStore } from "./edge-api-store.mjs";

const DEFAULT_ENV = {
  SEPATH_AUTH_SECRET: process.env.SEPATH_AUTH_SECRET || "",
  SEPATH_PRIVACY_MODE: process.env.SEPATH_PRIVACY_MODE || "pseudonymous",
  LLM_BASE_URL: process.env.LLM_BASE_URL || "",
  LLM_API_KEY: process.env.LLM_API_KEY || "",
  LLM_MODEL: process.env.LLM_MODEL || "",
  SEPATH_STORE: createMemoryEdgeStore(),
};

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

export function createLlmGatewayServer(env = DEFAULT_ENV) {
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
      res.end(JSON.stringify({ error: "llm_gateway_server_error", message: error.message }));
    }
  });
}

function readPort(argv) {
  const index = argv.indexOf("--port");
  if (index >= 0 && argv[index + 1]) return Number(argv[index + 1]);
  return Number(process.env.PORT || 8797);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const host = process.env.HOST || "127.0.0.1";
  const server = createLlmGatewayServer();
  server.listen(readPort(process.argv), host, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : readPort(process.argv);
    console.log(
      JSON.stringify({ runtime: "sepath-inference-gateway.v1", status: "listening", url: `http://${host}:${port}` }),
    );
  });
}

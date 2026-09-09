import { spawn } from "node:child_process";
import { once } from "node:events";
import { createEdgeApiServer } from "../../sepath-cloud-app/cloud/serve_edge_api_worker.mjs";

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

const server = createEdgeApiServer();
server.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
const port = typeof address === "object" && address ? address.port : 8787;
const apiBase = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, ["scripts/flow-tests.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    SEPATH_TEST_API_BASE: apiBase,
    SEPATH_TEST_APP_PORT: process.env.SEPATH_TEST_APP_PORT ?? "5313",
    SEPATH_TEST_CDP_PORT: process.env.SEPATH_TEST_CDP_PORT ?? "9513",
  },
});

try {
  const code = await waitForExit(child);
  if (code !== 0) {
    throw new Error(`API flow test failed with exit code ${code}`);
  }
  console.log(`SE-Path API flow tests passed with Edge API at ${apiBase}`);
} finally {
  server.close();
}

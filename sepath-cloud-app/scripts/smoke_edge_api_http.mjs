import { createEdgeApiServer } from "../cloud/serve_edge_api_worker.mjs";
import { createMemoryEdgeStore } from "../cloud/edge-api-store.mjs";

const authSecret = "sepath-smoke-secret";
const tokenIssuerSecret = "sepath-token-issuer-smoke-secret";
const githubWebhookSecret = "sepath-github-smoke-secret";
const githubWebhookToken = "sepath-legacy-webhook-smoke-token";
const server = createEdgeApiServer({
  SEPATH_PRIVACY_MODE: "pseudonymous",
  SEPATH_AUTH_SECRET: authSecret,
  SEPATH_TOKEN_ISSUER_SECRET: tokenIssuerSecret,
  SEPATH_GITHUB_WEBHOOK_SECRET: githubWebhookSecret,
  SEPATH_GITHUB_WEBHOOK_TOKEN: githubWebhookToken,
  SEPATH_STORE: createMemoryEdgeStore(),
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;

process.env.SEPATH_EDGE_API_BASE_URL = `http://127.0.0.1:${port}`;
process.env.SEPATH_EDGE_API_REPORT = "qa/edge-api-http-smoke-report.json";
process.env.SEPATH_AUTH_SECRET = authSecret;
process.env.SEPATH_TOKEN_ISSUER_SECRET = tokenIssuerSecret;
process.env.SEPATH_GITHUB_WEBHOOK_SECRET = githubWebhookSecret;
process.env.SEPATH_GITHUB_WEBHOOK_TOKEN = githubWebhookToken;

try {
  await import("./smoke_edge_api_worker.mjs");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

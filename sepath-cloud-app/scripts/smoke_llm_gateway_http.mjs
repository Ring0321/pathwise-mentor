import { createLlmGatewayServer } from "../cloud/serve_llm_gateway_worker.mjs";

const authSecret = "sepath-llm-smoke-secret";
const env = {
  SEPATH_AUTH_SECRET: authSecret,
  SEPATH_PRIVACY_MODE: "pseudonymous",
};
const privacyEnv = {
  SEPATH_AUTH_SECRET: authSecret,
  SEPATH_PRIVACY_MODE: "raw",
};

const server = createLlmGatewayServer(env);
const privacyServer = createLlmGatewayServer(privacyEnv);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
await new Promise((resolve) => privacyServer.listen(0, "127.0.0.1", resolve));

const address = server.address();
const privacyAddress = privacyServer.address();
const port = typeof address === "object" && address ? address.port : 0;
const privacyPort = typeof privacyAddress === "object" && privacyAddress ? privacyAddress.port : 0;

process.env.SEPATH_LLM_GATEWAY_BASE_URL = `http://127.0.0.1:${port}`;
process.env.SEPATH_LLM_GATEWAY_PRIVACY_BASE_URL = `http://127.0.0.1:${privacyPort}`;
process.env.SEPATH_LLM_GATEWAY_REPORT = "qa/llm-gateway-http-smoke-report.json";
process.env.SEPATH_AUTH_SECRET = authSecret;

try {
  await import("./smoke_llm_gateway_worker.mjs");
} finally {
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => privacyServer.close(resolve)),
  ]);
}

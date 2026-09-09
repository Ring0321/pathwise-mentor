// Typed deployment entry for Cloudflare/Vercel-style edge runtimes.
// The executable implementation lives in llm-gateway-worker.mjs so local smoke
// tests and static package audits exercise the same code path.
export { default, handleLlmGatewayRequest } from "./llm-gateway-worker.mjs";

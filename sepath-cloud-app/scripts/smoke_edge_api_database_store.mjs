process.env.SEPATH_TEST_STORE = "database";
process.env.SEPATH_EDGE_API_REPORT ||= "qa/edge-api-db-smoke-report.json";

await import("./smoke_edge_api_worker.mjs");

# SE-Path LLM Gateway 部署说明

`llm-gateway-worker.mjs` 是可执行的推理网关入口，用于把教师工作台接入真实模型网关；`llm-gateway-worker.ts` 是 typed wrapper，方便部署平台按 TypeScript 入口识别。主 Edge API Worker 也已托管同一个 `POST /api/ai/generate-scaffold` 路由，生产部署可优先使用同源 API；只有需要独立扩缩容或独立模型网关域名时，才单独部署该 Worker。

## 部署边界

- 前端只调用 `POST /api/ai/generate-scaffold`，可使用主 API 同源地址，也可通过 `VITE_SEPATH_LLM_GATEWAY_BASE` 指向独立网关。
- 生产环境开启 `SEPATH_AUTH_SECRET` 后，所有请求必须携带 SE-Path HMAC Bearer token。
- 模型密钥只放在 Worker、学校后端或云平台 Secret Store。
- 浏览器、前端静态资源和导出的 EvidenceEvent 都不能包含真实模型密钥。
- 缺少密钥、缺少模型名、隐私模式不合规或模型调用失败时，接口返回确定性 fallback，不阻断教师处理闭环。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `SEPATH_AUTH_SECRET` | HMAC token 验证密钥。本地 smoke 使用合成密钥，不进入真实配置。 |
| `LLM_BASE_URL` | OpenAI-compatible 网关地址，可为空并由部署环境默认注入。 |
| `LLM_API_KEY` | 模型服务密钥，只能配置在后端 Secret Store。 |
| `LLM_MODEL` | 学校或机构允许使用的模型名。 |
| `SEPATH_PRIVACY_MODE` | 建议固定为 `pseudonymous`。 |

真实密钥接入请走 `SECRET_SETUP.md` 中的 Cloudflare Secret 流程，或运行：

```powershell
cd sepath-cloud-app
npm run cloud:secrets:setup -- -CreateConfigFromExample
```

如果只是轮换模型服务密钥，使用：

```powershell
cd sepath-cloud-app
npm run cloud:secrets:setup -- -OnlyLlmKey
```

## 本地验收

```bash
cd sepath-cloud-app
npm run cloud:smoke:llm
npm run cloud:smoke:llm:http
```

两条命令会生成 `qa/llm-gateway-smoke-report.json` 和 `qa/llm-gateway-http-smoke-report.json`，覆盖缺 token、坏签名、教师 fallback、学生越权、只读巡检沙箱、隐私字段拦截、明文 learner 阻断、禁用 fallback 时 503 和隐私模式降级等场景。

本地 HTTP 适配器可用以下命令单独启动：

```bash
cd sepath-cloud-app
npm run cloud:serve:llm
```

## 请求入口

```http
POST /api/ai/generate-scaffold
content-type: application/json
authorization: Bearer sepath.<payload>.<signature>
```

请求体只应包含 `tenantId`、`courseId`、`learnerHash`、`traceId`、`evidenceEventIds`、`knowledgeSourceIds`、`guardrails` 和输出 schema，不传姓名、学号、仓库密钥、原始 CI 日志或完整 diff。

## 运行边界

这个 Worker 和 HTTP 适配器让 SE-Path 可以在无 Key 时稳定处理闭环，也可以在学校提供 OpenAI-compatible 模型网关后进入真实推理；但模型只负责表达、追问和脚手架生成，不能覆盖 SafeVOI、隐私门、Rubric 校准和教师发布门。

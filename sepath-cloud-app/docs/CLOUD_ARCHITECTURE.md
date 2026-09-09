# 云端架构与上线计划

## 当前形态

当前版本是静态 Web 应用，具备完整本地闭环：

- 前端：React + TypeScript + Vite。
- 状态：localStorage。
- 算法：前端纯函数实现，便于演示和测试。
- 上云：`npm run build` 后部署 `dist/`；或使用 Docker/Nginx。

这种形态适合比赛初赛：可快速演示、无外部账号依赖、不会暴露学生数据或 API Key。

## 正式上线形态

```text
Browser
  -> Web App
  -> API Gateway
  -> Evidence Ledger Service
  -> Agent Orchestrator
  -> Policy/Safety Service
  -> Teacher Review Service
  -> Postgres + Vector DB + Object Storage
  -> Git/CI/LMS Connectors
```

## 服务拆分

| 服务 | 职责 | 首版来源 |
| --- | --- | --- |
| Evidence Ledger Service | 写入和查询 EvidenceEvent，保证幂等和审计 | `src/engine/evidence.ts` |
| Diagnosis Service | 生成诊断卡和阻塞定位 | `src/engine/diagnosis.ts` |
| Policy Service | SafeVOI 行动排序和风险拦截 | `src/engine/safeVoi.ts` |
| Scaffold Agent Service | GraphRAG 检索、提示阶梯和拒答 | `src/engine/scaffold.ts` |
| Review Service | 教师复核工单、批量放行、审计日志 | `src/engine/reviewGate.ts` |
| Trace Service | 模型调用、工具调用、成本和质量门追踪 | `src/engine/traces.ts` |

## 可选云平台

- Vercel / Cloudflare Pages：最快静态部署。
- OpenAI Sites：用于快速分享演示原型。
- Docker + Nginx：适合学校或企业私有化演示。
- Supabase/Postgres：适合将 localStorage 迁移为真实数据账本。

## 上线前必须补齐

- 真实账号鉴权和角色权限。
- 数据脱敏、授权撤回和审计日志。
- 后端幂等写入和事件回放。
- 模型输出合同校验。
- RAG 引用校验和教师抽检集。
- 敏感信息扫描和部署环境隔离。

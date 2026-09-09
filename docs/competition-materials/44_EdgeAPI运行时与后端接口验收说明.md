# 44 Edge API 运行时与后端接口验收说明

## 1. 模块定位

Edge API 运行时用于证明 SE-Path 学伴不是只有前端页面和接口文档，而是已经具备可被调用、可被 smoke test、可迁移到云端 Worker 的后端接口参考实现。

新增文件：

- `sepath-cloud-app/cloud/edge-api-worker.mjs`
- `sepath-cloud-app/cloud/edge-api-auth.mjs`
- `sepath-cloud-app/cloud/edge-api-store.mjs`
- `sepath-cloud-app/cloud/serve_edge_api_worker.mjs`
- `sepath-cloud-app/cloud/README_EDGE_API.md`
- `sepath-cloud-app/cloud/openapi.sepath.json`
- `scripts/validate_openapi_contract.py`
- `sepath-cloud-app/scripts/smoke_edge_api_worker.mjs`
- `sepath-cloud-app/scripts/smoke_edge_api_http.mjs`
- `sepath-cloud-app/qa/edge-api-smoke-report.json`
- `sepath-cloud-app/qa/edge-api-http-smoke-report.json`
- `sepath-cloud-app/qa/openapi-contract-validation.json`

该模块覆盖 HMAC 访问令牌校验、证据接入与读回、诊断读取、干预排序、教师复核工单写入与读回、账本导入、隐私审计和 RBAC 越权拦截后端能力，并通过 `npm run cloud:smoke` 与 `npm run cloud:smoke:http` 自动验收。前者直接导入 Worker，后者启动本地 HTTP 适配器并发送真实 HTTP 请求。

## 2. 实现的 API

| API | 方法 | 作用 | 当前验证 |
|---|---|---|---|
| `/api/health` | GET | 返回运行时版本和可用端点 | smoke 通过 |
| `/api/evidence/events` | POST | 接收脱敏 EvidenceEvent 事件 | smoke 通过 |
| `/api/evidence/events` | GET | 读取已写入的脱敏 EvidenceEvent | smoke 通过 |
| `/api/learners/{learnerHash}/diagnosis` | GET | 读取脱敏学生诊断卡 | smoke 通过 |
| `/api/interventions/rank` | POST | 使用 SafeVOI 风格评分排序干预行动 | smoke 通过 |
| `/api/review/tickets` | POST | 创建教师发布门复核工单 | smoke 通过 |
| `/api/review/tickets` | GET | 读取教师发布门复核工单队列 | smoke 通过 |
| `/api/ledgers/import` | POST | 校验证据账本导入、重复事件和坏事件 | smoke 通过 |
| `/api/privacy/audit` | GET | 返回隐私门禁、角色禁止动作和审计事件 | smoke 通过 |

## 3. 后端运行方式

本地验收：

```bash
cd sepath-cloud-app
npm run cloud:smoke
npm run cloud:smoke:http
npm run cloud:openapi:validate
```

输出示例：

```json
{
  "pass": 14,
  "fail": 0,
  "endpointsCovered": 14
}
```

验收报告写入：

```text
sepath-cloud-app/qa/edge-api-smoke-report.json
sepath-cloud-app/qa/edge-api-http-smoke-report.json
sepath-cloud-app/qa/openapi-contract-validation.json
```

这两个报告会进入最终提交包，并被 `release_gate.py` 调用。

如需人工调试 HTTP 接口，可运行：

```bash
npm run cloud:serve
```

随后访问 `/api/health` 或使用 curl/Postman 调用其他接口。

## 4. 关键工程边界

### 4.1 无真实数据库时的行为

当前 Worker 使用可注入存储接口。比赛包内默认提供 `memory-edge-store.v1`，用于评审时证明 EvidenceEvent 和教师复核工单可以写入后读回；它不会写真实生产数据库，也不会保存真实学生数据。

生产接入时应连接：

- Postgres / Supabase / Cloudflare D1。
- `sepath_evidence_events`、`sepath_review_tickets`、`sepath_audit_events` 等表。
- RLS 和 tenantId/courseId/learnerHash 隔离策略。

### 4.2 隐私字段拦截

Worker 会拒绝包含以下字段的载荷：

- `rawLog`
- `rawDiff`
- `studentRealName`
- `studentName`
- `email`
- `phone`
- `mobile`
- `accessToken`
- `apiKey`
- `secret`
- `password`

这证明系统不会把原始 CI 日志、仓库密钥、学生实名或联系方式直接写入学习证据账本。

### 4.3 SafeVOI 后端化

`/api/interventions/rank` 会对候选行动计算 SafeVOI 风格得分，并阻断：

- 直接替写可提交代码。
- 高风险不可逆行动。
- 付费服务或诱导消费行动。
- consent/rules 无效的行动。

安全行动会进入 `rankedActions`，阻断行动进入 `blockedActions`，并设置 `teacherReviewRequired`。

### 4.4 教师发布门

`/api/review/tickets` 会生成 `pending_teacher_review` 工单，要求教师确认风险原因、选择脚手架或 mini lab，并明确不能发布完整答案。这和产品内“教师复核”“干预发布与教学行动包中心”保持一致。

### 4.5 HMAC 访问令牌边界

当环境变量 `SEPATH_AUTH_SECRET` 存在时，Worker 会要求请求提供 `Authorization: Bearer sepath.<payload>.<signature>`。`edge-api-auth.mjs` 使用 HMAC-SHA256 对 payload 签名，payload 可携带 `role`、`learnerHash`、`reviewMode`、`iat`、`nbf` 和 `exp` 等声明。缺失令牌会返回 `401 unauthorized / missing_token`，伪造签名或格式错误会返回 `401 unauthorized / bad_signature` 或 `bad_token_format`，不会进入业务路由。

为了便于本地无密钥评审，未配置 `SEPATH_AUTH_SECRET` 时保留 header demo 模式；正式上线应开启该环境变量，或替换为学校 SSO/API Gateway 的令牌校验器。

### 4.6 角色权限边界

Worker 默认把未声明角色的请求视为 `reviewer`。在 token 模式下，角色与 learner scope 来自已验签的令牌声明。评委角色只读，不能写 EvidenceEvent、导入账本或创建复核工单；学生角色必须带自己的 `learnerHash`，只能读取自己 learnerHash 范围内的数据；教师、课程管理员和系统角色才能执行课程管理类写操作。smoke test 已验证“评委写入被 403 拦截”“学生宽范围读取班级证据被 403 拦截”“缺失令牌被 401 拦截”和“伪造令牌被 401 拦截”。

## 5. 与产品模块的关系

- API 契约中心：定义接口、字段、鉴权范围、幂等键和迁移路线。
- 集成回放沙箱：用 Git/CI/LMS/飞书样例解释外部事件如何映射 EvidenceEvent。
- Edge API 运行时：把核心契约做成可调用 Worker，并用 direct smoke 与 HTTP smoke 双路径验收。
- 生产数据平面：给出真实数据库表、RLS、索引、备份和环境变量边界。
- 评委云端交付体检中心：把 `npm run cloud:smoke`、`npm run cloud:smoke:http` 和两份 JSON 报告纳入上线探针。

## 6. 评委可检查证据

1. 打开 `sepath-cloud-app/cloud/edge-api-worker.mjs`，查看真实路由实现。
2. 打开 `sepath-cloud-app/cloud/serve_edge_api_worker.mjs`，查看 HTTP 适配器实现。
3. 打开 `sepath-cloud-app/cloud/openapi.sepath.json`，查看 10 个 operation、Schema、HMAC Bearer 鉴权和隐私边界扩展。
4. 运行 `npm run cloud:smoke`、`npm run cloud:smoke:http` 和 `npm run cloud:openapi:validate`，查看两条 Edge API 验收路径均 14 个检查通过，OpenAPI 契约 0 FAIL。
5. 打开 `sepath-cloud-app/qa/edge-api-smoke-report.json`、`sepath-cloud-app/qa/edge-api-http-smoke-report.json` 与 `sepath-cloud-app/qa/openapi-contract-validation.json`，查看机器生成的接口验收摘要。
6. 打开产品顶部“云交付”，查看 Edge API Runtime、Edge API smoke test 和 Edge API HTTP smoke test 已进入产品交付面板。
7. 打开 `scripts/release_gate.py`，确认 smoke test 和 OpenAPI 校验已进入最终发布门禁。

## 7. 可在答辩中强调的创新

1. 前端 Demo 与后端接口不是两张皮：产品内 API 契约、HMAC 令牌工具、Worker 实现、smoke test、云交付面板和提交审计互相引用。
2. SafeVOI 不只是前端排序，而是已经有后端接口形态，未来可接学校真实课程系统。
3. 隐私门禁不只是文案，Worker 会实际拒绝包含敏感字段的请求。
4. 教师复核不是静态卡片，后端可创建 `pending_teacher_review` 工单。
5. 评审现场无需真实密钥和数据库，也能验证接口行为；真实试点时再连接数据库和学校身份源。

## 8. 真实性边界

当前可以声明：

- 已有可运行 Edge API 参考实现。
- 已有自动 smoke test 覆盖关键端点、证据读回、教师复核工单读回、HMAC 令牌鉴权、缺失/伪造令牌拦截和角色越权拦截。
- 已有隐私字段拦截、SafeVOI 排序和教师工单响应。
- 已纳入最终 release gate 和提交包。

当前不能声明：

- 已连接真实生产数据库。
- 已接入真实学校 SSO、LTI 或学生名册。
- 已达到生产 SLA 或完成安全渗透测试。
- 已在真实班级中验证学习成绩提升。

## 9. 下一步产品化路线

1. 将 `memory-edge-store.v1` 替换为 Postgres/Supabase/D1 持久化适配器。
2. 把 `/api/evidence/events` 接入 GitHub/GitLab/Gitee 和 CI Webhook。
3. 把 `/api/review/tickets` 接入飞书卡片或学校 LMS 通知。
4. 接入 OpenTelemetry trace 和 dead-letter 队列。
5. 增加 D1/Postgres 集成测试、鉴权测试和 RLS 回归测试。

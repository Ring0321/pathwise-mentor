# SE-Path Adaptive Learning Companion

SE-Path 学伴是面向软件工程项目制学习的自适应学习路径决策与伴学原型。当前交接仓库保留“可继续开发”的源码、配置、接口/部署说明和必要项目文档，刻意排除了依赖目录、构建产物、日志、真实环境变量、浏览器缓存、旧提交 ZIP 以及路演视频/PPT/DOCX 等大体积材料。

## 交接重点

- `sepath-yudao-teacher-console/`：当前主线。Vue 3 + Element Plus 教师工作台，覆盖教师待办、证据账本、学生回流、Rubric 配置、课程运营、任务包发布与验收闭环。
- `sepath-cloud-app/`：云化/公开试用原型。React + Vite，包含前端面板、确定性引擎、Edge API/LLM gateway/数据平面示例、腾讯云部署脚本和 OpenAPI/验证文档。
- `scripts/`：根目录支撑脚本，供 `sepath-cloud-app` 的若干验证命令继续按原相对路径调用。
- `docs/`：产品设计、比赛口径、源码与上云说明、真实性边界、平台填写和人工确认模板。

## 本地启动

建议使用 Node.js 20.19+ 或 Node.js 22+。

### 教师工作台主线

```bash
cd sepath-yudao-teacher-console
npm ci
npm run dev
npm run build
```

常用验证：

```bash
npm run typecheck
npm run test:flow
npm run test:api-flow
```

### 云化原型

```bash
cd sepath-cloud-app
npm ci
npm run dev
npm test
npm run build
```

云端/接口相关命令见 `sepath-cloud-app/README.md`、`sepath-cloud-app/docs/` 和 `sepath-cloud-app/cloud/`。

## 继续开发边界

- AI 只产出候选诊断、候选建议、脚手架和检查清单；发布、评价、风险判断、教学干预等结果必须由教师确认。
- 增值评价只用于形成性诊断和改进依据，不做学生排名、惩罚、就业预测或高风险自动决策。
- 真实学校/班级/学生数据接入前，保持 mock/示例数据口径，并补齐授权、脱敏、审计和回滚机制。
- 真实环境变量不要提交到仓库；按 `.env.example`、`.env.cloud.example`、`deploy/**/*.env.example` 或 `cloud/wrangler.sepath.example.toml` 另行配置。

## 当前验证状态

- `sepath-yudao-teacher-console`: `npm ci` 通过，`npm run build` 通过；构建有 chunk 体积提示，不影响产物生成。
- `sepath-cloud-app`: `npm ci` 通过，`npm test` 通过 28 个用例，`npm run build` 通过；构建有 chunk 体积提示，不影响产物生成。
- `sepath-yudao-teacher-console` 的 `npm run test:api-flow` 当前失败在既有断言 `Course settings drawer must expose the active storage mode.`；原始工作目录同样失败，说明这是现有端到端脚本与当前界面状态的待修复项，不是本交接包漏文件。

## 未纳入本仓库的内容

- `node_modules/`、`dist/`、`logs/`、`*.log`、浏览器 QA profile、截图和下载缓存。
- 旧版 `sepath-learning-companion-v2/` React 小原型；它是早期阶段样例，不再作为当前主线。
- `sepath-sites-app/` Sites 项目；该目录有独立远端和未提交状态，未混入本次源码交接。
- 旧 ZIP、视频、PPT、DOCX 等参赛交付大文件；需要时请从原工作目录或正式材料包另取。

## 交接生成时间

本源码交接包于 2026-09-09 从本地工作目录整理生成，原始工作目录未被覆盖。

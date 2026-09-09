# SE-Path 学伴 Demo 启动与演示说明

本文档用于评委、队伍成员或现场工作人员快速启动并复现实物 Demo。推荐先使用云端版本展示可上线能力，再使用本地版本展示源码可运行与可验证能力。

如果现场只能先打开一个文件，请打开：

```text
参赛提交材料包/00_评委一键打开入口.html
```

该入口会直达公开试用 Demo、5 分钟评委演练包、本地运行环境自检包、平台提交终检包、一等奖差异化创新证据包、主张证据账本与真实性核验包、演示视频、PPT、PDF、终审报告、阶段 ZIP Manifest 和真实性边界说明。

如果评委给出的时间窗口不同，按 `参赛提交材料包/59_三段式评委评审路线与口径同步说明.md` 选择路线：3 分钟讲清楚、5 分钟跑闭环、10 分钟技术复核。

正式上传前最后使用 `参赛提交材料包/60_平台提交终检与上传凭证包.md`。它把平台字段、上传顺序、禁止夸大声明、提交后回执截图和最终 manifest SHA256 归档放在同一张清单里。

答辩前最后复核 `参赛提交材料包/61_一等奖差异化创新证据包.md`。它把五项评分、创新断点、源码证据、科研融合、开源边界和评委追问回答压缩成冲奖证据地图。

评委追问“你们哪些结论已经证明、哪些只是试点准备”时，打开 `参赛提交材料包/62_主张证据账本与真实性核验包.md`。它把 12 条核心主张、L0-L3 声明等级、禁止表述和证据路径绑定到机器可读 JSON。

产品内也可以直接点击顶部导航“主张账本”，定位到 `#claim-ledger`。该面板会把当前 Demo 证据事件、试点证据、评委演练、技术验收和上线验收汇总成可筛选的主张矩阵。

## 1. 推荐演示路径

<!-- SEPATH_PUBLIC_DEPLOY_INDEX_START -->
## 0A. 公网部署与最终 URL 回执

如果评审平台要求一个匿名可访问的公网 HTTPS Demo，先打开：

```text
参赛提交材料包/70_公网部署实操包与回执封存说明.md
参赛提交材料包/71_公网URL回填后的正式提交收口说明.md
参赛提交材料包/public-deploy-playbook/PUBLIC_DEPLOY_PLAYBOOK.json
```

当前状态 `ready_for_human_public_deploy`，最终公网 URL 状态 `pending_external_public_url`，公开上传包 SHA256 `bbac97cd49c926f94a25cde1eeaffbb36ea96f33a47b42371e9b2c7691090bc0`。

部署后必须运行：

```powershell
rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write
rtk python scripts/finalize_public_url_receipt.py --url https://your-public-demo.example --write --sync-platform-copy
rtk python scripts/finalize_submission_after_public_url.py --url https://your-public-demo.example --write --sync-platform-copy
```

在回执变为 `ready_for_platform` 之前，不要把 `PENDING_FINAL_PUBLIC_URL`、owner-only 私有云、localhost 或历史 Sites 链接写成最终公网地址；正式提交前再用 71 号收口报告确认 URL、平台文案、正式画像、命名副本、发布门禁和一致性检查没有互相打架。
<!-- SEPATH_PUBLIC_DEPLOY_INDEX_END -->

正式答辩时建议按以下顺序展示：

1. 打开云端私有部署地址，说明项目已经具备上云发布能力。
2. 打开本地 Demo，按页面主按钮从左到右完成闭环演示。
3. 展示学生对话实验台、集成回放沙箱、仓库证据接入、班级 GrowthOps、策略实验室、课程配置与 Rubric Studio、教师周报与试点复盘、干预发布与教学行动包中心、教师标注与 Rubric 校准、科研算法融合、推理网关与 GraphRAG 试验台、学校初始化与演示账号中心、生产数据平面与部署运维中心、最终上传与路演控制台、评委云端交付体检中心、评委技术验收中心、评委 5 分钟实操演练中心、一键评委导览模式、课程开班向导、多租户上云运营、课程试点、权限与隐私治理、API 与集成契约、学习增值评估中心、试点遥测与效果验证中心、评委试用与交付控制台、比赛提交助手、视频与路演导演、AI Agent 运行时与模型接入中心、模型与实验治理、证据账本、Agent 决策台、路径状态、课程知识边界、算法验证证据、参赛评审证据、上线交付证据和教师复核台。
4. 点击“导出证据账本”和“导入账本”，说明所有建议都可追溯、可迁移、可恢复。
5. 展示测试、构建、QA 截图和阶段提交包 manifest。
6. 运行 `npm run cloud:smoke`、`npm run cloud:smoke:http`、`npm run cloud:smoke:llm`、`npm run cloud:smoke:llm:http`、`npm run cloud:openapi:validate`、`npm run cloud:demo-seed`、`npm run cloud:pwa:validate`、`npm run cloud:slo` 和 `npm run cloud:reviewer-drill`，说明 Edge API Worker 的证据写入读回、诊断读取、干预排序、教师复核工单读回、账本导入、隐私审计、HMAC 令牌鉴权、角色越权拦截，LLM Gateway 的无 Key fallback、隐私拦截、schema 契约和 HTTP 入口，OpenAPI 机器契约，评委试用账号与种子事件，公开试用 PWA 离线容灾，云端 SLO 容量压测，以及评委 300 秒实操路线均可被机器验收。
7. 如时间有限，可直接播放 `演示视频素材/SE-Path学伴_4分40秒演示视频素材_v0.3.mp4` 作为闭环演示底稿。
8. 正式提交当天打开 `60_平台提交终检与上传凭证包.md`，确认平台字段、上传附件、访问策略和上传回执归档。
9. 答辩前打开 `61_一等奖差异化创新证据包.md`，按 60 秒主讲口径和追问回答卡统一表达。
10. 被追问真实性、试点边界或证据路径时打开产品内“主张账本”或 `62_主张证据账本与真实性核验包.md`，只按 L0/L1 当前证据表述，不提前宣称 L2/L3 真实效果。

## 2. 云端访问

当前 Sites 私有部署地址：

```text
https://sepath-xueban.ring0321.chatgpt.site
```

访问模式为 owner-only 私有访问。未登录或非授权访问返回 401/403 是预期结果，表示访问控制生效。正式公开路演前可按比赛要求切换为公开访问。

## 2A. 公开试用静态包

如果评审现场需要一个无需登录的公开只读版本，可以使用：

```text
参赛提交材料包/公开试用静态包/
```

该目录由 `python scripts/build_public_trial_bundle.py` 从最新 `sepath-cloud-app/dist` 生成，包含 `index.html`、`assets/`、`README_公开试用.md`、`PUBLIC_TRIAL_MANIFEST.json`、`JUDGE_DEMO_SEED_MANIFEST.json`、`REVIEWER_DRILL_REPORT.json`、`reviewer-guide-overlay.png`、`manifest.webmanifest`、`sw.js` 和 `offline.html`。把整个目录上传到 Vercel、Netlify、Cloudflare Pages、OpenAI Sites 或 Nginx 静态服务器即可试用；单页应用路由统一回退到 `/index.html`。如果通过 HTTPS 托管，浏览器可注册 Service Worker，首访后遇到短暂网络波动时可回退到缓存入口或离线说明页。公开包首页保留“一键评委导览”，评委可以直接按 300 秒路线复核产品能力。

## 2B. 本地运行环境自检包

如果评委要复核源码本地运行，建议先打开：

```text
参赛提交材料包/local-run-doctor/README.md
参赛提交材料包/local-run-doctor/LOCAL_RUN_DOCTOR.json
```

该包默认只诊断环境和材料链路，不安装依赖、不启动服务。Windows 现场可进入目录后运行：

```powershell
cd 参赛提交材料包/local-run-doctor
./RUN_LOCAL_DEMO.ps1
./RUN_LOCAL_DEMO.ps1 -OpenStatic
./RUN_LOCAL_DEMO.ps1 -Install
./RUN_LOCAL_DEMO.ps1 -Start
```

其中 `-OpenStatic` 打开无需安装的公开静态包，`-Install` 才会执行 `npm install`，`-Start` 才会执行 `npm run dev`。如果 Node/npm、网络或端口受限，可按 `fallback_routes.md` 切换到公开静态包、技术材料复核或演示视频。

## 3. 本地启动

进入本地演示工程：

```bash
cd sepath-cloud-app
npm install
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5188
```

如果 5188 被占用，Vite 会自动选择其他端口，按终端输出地址打开即可。

## 4. 演示操作顺序

页面顶部主按钮会根据状态自动变更文案。完成核心闭环后，使用顶部导航补充展示学生对话、集成回放、策略实验、课程配置、教师周报、干预发布、Rubric 校准、云交付、技术验收、课程试点、知识边界与评审证据：

| 步骤 | 点击按钮 | 评委应看到什么 | 对应赛题能力 |
| --- | --- | --- | --- |
| 1 | 提交失败 PR | 新增 Git/CI 失败证据，诊断卡出现阻塞原因 | 学情诊断 |
| 2 | 学生请求完整代码 | 系统识别直接索要答案的风险，进入安全发布门 | 实时干预与安全边界 |
| 3 | 推送脚手架提示 | 系统给排查清单和 mini lab，不直接替写答案 | 脚手架辅导 |
| 4 | 学生修复并通过 CI | 能力分数、路径节点和证据覆盖率更新 | 路径规划 |
| 5 | 顶部导航：学生对话 | 输入或选择“直接要代码”，观察意图识别、拒绝替写、微行动追问和写入证据账本 | 对话诊断与实时干预 |
| 6 | 顶部导航：仓库接入 | 导入 Issue、PR、CI、Review 和反思样本，系统自动去重并更新账本 | 真实可落地 |
| 7 | 顶部导航：班级运营 | 展示班级风险分层、干预队列、教师节省时间和飞书同步预览 | 商业价值与规模化 |
| 8 | 顶部导航：策略实验 | 展示普通聊天、固定路径和 SafeVOI 闭环的同事件对照仿真 | 创新性与技术水平 |
| 9 | 顶部导航：课程配置 | 展示课程工作空间、能力 Rubric、软件工程作业模板、AI 使用边界和课程 Manifest | 创新性与产品化 |
| 10 | 顶部导航：教师周报 | 展示指标、学生阻塞、班级信号、下周行动、AI 边界和 Markdown 下载 | 教师复盘与交付 |
| 11 | 顶部导航：干预发布 | 展示学生脚手架卡、班级 mini lab、教师复核队列、API 通道、回滚规则和禁止替写护栏 | 实时干预与可上线 |
| 12 | 顶部导航：Rubric校准 | 展示教师锚点、AI 估计、一致性阈值、标注队列、漂移检查和发布门禁 | 可信诊断与真实落地 |
| 13 | 顶部导航：开班向导 | 展示 D-7 到 W1 首周开班步骤、真实接入链路、课程启动包、风险登记和 Manifest | 商业价值与可落地 |
| 14 | 顶部导航：课程试点 | 展示班级接入、真实数据治理、教师确认和分阶段上线门禁 | 商业价值与可落地 |
| 15 | 顶部导航：隐私治理 | 展示比赛评委只读、学生不可导出班级账本、敏感字段扫描为 0 和越权请求被拦截 | 安全治理与商业落地 |
| 16 | 顶部导航：API契约 | 展示 `/api/evidence/events`、Webhook、环境变量、幂等键和 tenantId/courseId 隔离 | 可上线与可集成 |
| 17 | 顶部导航：集成回放 | 展示 Git、CI、LMS、飞书 Webhook 样例如何脱敏、幂等、匹配契约并写入 EvidenceEvent | 可上线与可集成 |
| 18 | 顶部导航：知识边界 | 展示 Rubric、代码证据、AI 使用策略和反思记忆 | 技术水平 |
| 19 | 顶部导航：算法验证 | 展示消融对照、证据覆盖、知识命中、策略门控和真实试点边界 | 技术水平与创新性 |
| 20 | 顶部导航：科研融合 | 展示开源参考矩阵、自研算法贡献、研究假设、验证阶梯和论文/答辩转化 | 科研性与一等奖叙事 |
| 21 | 顶部导航：增值评估 | 展示能力增量、SafeVOI 策略优势、可解释增值估计和真实试点声明边界 | 科研性与商业价值 |
| 22 | 顶部导航：试点遥测 | 展示真实课程数据契约、教师确认 A/B、效果指标、声明门禁和遥测 Manifest | 科研验证与商业落地 |
| 23 | 顶部导航：租户运营 | 展示学校租户、课程复制、RBAC、席位预算、SLO、Runbook、租户 Manifest 和回滚路径 | 上云落地与商业化 |
| 24 | 顶部导航：账号初始化 | 展示学校管理员、教师、学生、评委入口、SSO/LTI、邀请策略、无密码提交包和账号 Manifest | 可上线与可试用 |
| 25 | 顶部导航：数据平面 | 展示 Postgres/Supabase 表结构、RLS、备份恢复、健康探针、环境变量和 `sepath-data-plane.v1` | 可上线与可运维 |
| 26 | 顶部导航：AI运行时 | 展示确定性策略、可选 LLM 表达层、GraphRAG 上下文包、工具 Trace、质量门和无 Key 降级 | 智能体架构与可上线 |
| 27 | 顶部导航：推理网关 | 展示 `/api/ai/generate-scaffold`、HMAC 鉴权、Worker 密钥隔离、GraphRAG 上下文、fallback 响应、LLM smoke 报告和推理 Manifest | 真实智能接入与可上线 |
| 28 | 顶部导航：模型治理 | 展示算法注册表、离线回放、教师确认 A/B、发布门和漂移监控 | 科研性与可迭代 |
| 29 | 顶部导航：评审证据 | 展示官方评分项与实现证据、提交材料的映射 | 创新性与体验 |
| 30 | 顶部导航：上线交付 | 展示健康检查、云端访问、监控指标、回滚策略和人工门禁 | 商业价值与可落地 |
| 31 | 顶部导航：评委试用 | 展示公开静态包、PWA 离线容灾、私有云、本地 Demo、视频兜底、源码审计、评委任务包、评委试用种子包和评分证据矩阵 | 商业价值与可交付 |
| 32 | 顶部导航：SLO容量 | 展示合成 Worker 压测、P95、错误率、降级路径、容量计划和成本预算 | 技术稳定性与上线可信度 |
| 33 | 顶部导航：评委演练 / 一键评委导览 | 展示 300 秒评委实操路线、五类试用身份、教师复核深潜、SLO 证据、评分映射、兜底路线、固定导览条和 `sepath-reviewer-guide.v1` | 评审体验与可复核交付 |
| 34 | 顶部导航：提交助手 | 展示官方要求、材料资产、打包命令、时间节点、平台文案和人工项 | 材料完整与可提交 |
| 35 | 顶部导航：路演导演 | 展示 3-5 分钟镜头表、旁白终检、评分覆盖、录制路线、导出素材和风险口径 | 评审体验与提交成熟度 |
| 36 | 顶部导航：最终上传 | 展示单 ZIP/多栏上传、正式命名副本、提交日 20 分钟流程、答辩锚点和禁止夸大口径 | 提交完整度与可信边界 |
| 37 | 顶部导航：云交付 | 展示公开静态包、Sites 私有云、本地源码、视频兜底、健康探针、失败切换和人工访问策略 | 可上云与可交付 |
| 38 | 顶部导航：技术验收 | 展示 46 号技术验收包、机器可读证据、Edge API 直调/HTTP 烟测、源码热点、10 分钟复查路线和真实性边界 | 评委复核与技术可信 |
| 39 | 终端：`npm run cloud:smoke`、`npm run cloud:smoke:http`、`npm run cloud:smoke:llm`、`npm run cloud:smoke:llm:http`、`npm run cloud:openapi:validate`、`npm run cloud:reviewer-drill` | Edge API Worker direct/HTTP 两条路径 14 个场景验收通过；LLM Gateway direct/HTTP 两条路径各 10 个场景验收通过；OpenAPI 覆盖 10 个 operation 和 11 个核心 Schema；评委演练报告验证 300 秒路线、后端状态锚点、材料锚点和真实性边界 | 后端可调用与评委可复核 |
| 40 | 教师复核放行 | 教师复核台显示可处理工单与风险理由 | 人机协同 |
| 41 | 顶部导航：教师复核 -> 导入账本 | 选择已导出的 JSON，系统校验并去重合并 EvidenceEvent | 可迁移与可复盘 |
| 42 | 生成反思记忆 | 长期记忆和复盘证据写入账本 | 记忆与反思 |

如需重新演示，点击“重置演示”。

## 5. 录屏检查点

录屏时至少停留以下区域：

- 顶部指标：证据事件数、证据覆盖率、路径完成度、云端形态。
- 学生对话实验台：展示直接要代码被拦截、回复改写为脚手架、对话可写回 EvidenceEvent。
- 集成回放沙箱：展示 CI Webhook 样例如何通过幂等、脱敏、契约匹配并写入 EvidenceEvent。
- 仓库证据接入：展示软件工程真实过程证据如何进入同一套 EvidenceEvent 账本。
- 班级 GrowthOps：展示多个学生风险分层、干预队列和飞书同步任务。
- 策略实验室：展示同一组学习事件下，SE-Path SafeVOI 为什么比普通聊天和固定路径更安全、更可追溯。
- 课程配置与 Rubric Studio：展示 Learning Design as Code、CI Recovery Lab、AI 边界和可导出课程 Manifest。
- 教师周报与试点复盘：展示本周证据、班级信号、下周行动、AI 边界和 Markdown 下载。
- 干预发布与教学行动包中心：展示学生脚手架卡、班级 mini lab、教师复核队列、API 通道、回滚规则、付费行动阻断器和 `sepath-intervention-playbook.v1`。
- 教师标注与 Rubric 校准：展示 teacherAnchor、aiEstimate、delta、教师-AI 一致性、标注队列、漂移监控和 `sepath-rubric-calibration.v1` Manifest。
- 课程开班向导：展示首周开班步骤、真实接入链路、课程启动包、风险登记和可下载 Manifest。
- 课程试点：展示真实课程落地前的班级接入、数据最小化、教师确认和四阶段试点路径。
- 权限与隐私治理：展示角色最小权限、敏感字段扫描、比赛评委只读和越权请求拦截。
- API 与集成契约：展示核心 API、Webhook、幂等键、环境变量、租户隔离、OpenAPI 机器契约和 `sepath-openapi-contract.v1` Manifest。
- 模型与实验治理：展示 SafeVOI、路径数字孪生、知识边界、红队实验和漂移监控。
- AI Agent 运行时：展示模型路由、Prompt 契约、RAG 上下文包、工具 Trace、质量门和无 Key 降级。
- 推理网关与 GraphRAG 试验台：展示 Worker 密钥隔离、HMAC 鉴权、`/api/ai/generate-scaffold`、GraphRAG 上下文包、确定性 fallback、`npm run cloud:smoke:llm`、`npm run cloud:smoke:llm:http` 和 `sepath-inference-gateway.v1` Manifest。
- 学校初始化与演示账号中心：展示学校管理员、课程管理员、教师、学生、评委五类入口、SSO/LTI 设计、无密码提交包、评委试用种子包、`sepath-school-provisioning.v1` Manifest 和 `sepath-judge-demo-seed.v1` Manifest。
- 生产数据平面与部署运维中心：展示 `sepath-data-plane.v1`、Postgres/Supabase 表结构、RLS、备份恢复、健康探针、环境变量和无真实数据库密钥边界。
- 学生能力画像：展示能力不是静态分数，而是由证据事件动态更新。
- Agent 决策台：展示 SafeVOI 排序、风险和下一步行动。
- 课程知识边界：展示 Rubric、代码证据、AI 使用策略和反思记忆如何共同约束回答。
- 算法验证证据：展示 SE-Path 与普通聊天助手、规则脚本伴学和真实课程试点之间的消融边界。
- 科研算法融合：展示 Open edX、Moodle、LangGraph、OpenTelemetry 等开源参考边界、自研算法贡献、研究假设和 `sepath-research-fusion.v1` Manifest。
- 学习增值评估：展示能力增量、SafeVOI 策略优势、可解释增值估计和 Telemetry Contract。
- 试点遥测与效果验证：展示真实课程试点的数据契约、Git/CI 遥测流、教师确认 A/B、阻塞解除时间、反思质量、教师负担和真实提分声明门禁。
- 多租户上云运营：展示学校租户、课程复制、评委沙箱、RBAC、席位预算、SLO、异常回滚和 `sepath-tenant-ops.v1` Manifest。
- 参赛评审证据：展示智能体架构、自适应策略、功能完整、创新体验和商业价值五项证据。
- 上线交付证据：展示 Demo 不是临时页面，而具备健康检查、监控指标、降级回滚和人工发布门。
- 评委试用控制台：展示公开静态包、PWA 离线容灾、owner-only 私有云、本地 Demo、视频兜底、源码审计路线、评委任务包、五类合成试用身份、七条种子事件、十分钟评委路线和评分证据矩阵。
- 后端连接状态中心：展示静态试用、Edge API、LLM Gateway、数据库授权、评委种子、试点遥测、SLO 和降级边界，避免把未授权生产库包装成已上线。
- 评委 5 分钟实操演练中心：展示 `npm run cloud:reviewer-drill`、300 秒路线、五类视角、教师复核深潜、SLO 证据、后端状态、评分映射、兜底路线和一键导览工具条。
- 比赛提交助手：展示官方提交要求、材料资产、打包验证步骤、时间节点、平台文案和人工确认项。
- 视频与路演导演：展示目标 4分36秒镜头表、评分覆盖矩阵、真人旁白人工项、SRT/VTT 资产、v0.4 复剪路线和不夸大真实提分的口径控制。
- 最终上传与路演控制台：展示单 ZIP/多栏上传、正式命名副本、提交日 20 分钟流程、答辩锚点、禁止夸大口径和 `sepath-final-submission.v1`。
- 评委云端交付体检中心：展示公开静态包、Sites 私有云、本地源码复现、视频兜底、健康探针、失败切换、人工访问策略和 `sepath-cloud-handoff.v1`。
- 云端 SLO 与容量压测中心：展示 `npm run cloud:slo` 生成的合成 Worker 负载报告、P95、错误率、降级预算、成本守卫和真实性边界。
- 评委技术验收中心：展示 46 号验收包、release gate、自动终审、Edge API 两条烟测、SLO 容量压测、10 分钟复查路线、源码热点和 `sepath-judge-verification.v1`。
- Edge API 运行时：展示 `edge-api-auth.mjs`、`edge-api-worker.mjs`、`edge-api-store.mjs`、`serve_edge_api_worker.mjs`、`openapi.sepath.json`、`npm run cloud:smoke`、`npm run cloud:smoke:http`、`npm run cloud:openapi:validate`、HMAC 令牌鉴权、缺失/伪造令牌拦截、隐私字段拦截、RBAC 越权拦截、SafeVOI 后端排序、证据读回、教师复核工单读回、OpenAPI 契约校验和三份后端契约 JSON 报告。
- 路径看板：展示路径数字孪生如何标记 blocked / active / completed。
- 教师复核台：展示高风险建议不会自动放行。
- 证据采集与交付：展示系统可以补证据、导出 JSON 账本，并导入 JSON 账本恢复工作空间。

## 6. 验证命令

本地演示工程：

```bash
cd sepath-cloud-app
npm run test
npm run build
npm run cloud:reviewer-drill
npm run qa:screenshots
```

云端部署工程：

```bash
cd sepath-sites-app
npm test
```

阶段提交包：

```bash
python scripts/package_sepath_submission.py
python scripts/audit_submission_readiness.py
```

当前包体低于官网 100MB 限制，ZIP 完整性、必需路径和敏感信息扫描结果见：

```text
submission/SE-Path学伴_阶段提交包_v0.4_2026-08-09_manifest.json
参赛提交材料包/09_提交前终审报告_机器可读.json
```

演示视频素材：

```bash
cd sepath-cloud-app
node ./scripts/capture_demo_flow.mjs
cd ..
python scripts/build_demo_video.py
python scripts/build_demo_narration_assets.py
```

## 7. 演示口径

一句话定位：

> SE-Path 学伴不是普通聊天助手，而是把软件工程项目中的 Issue、PR、CI、评审、对话和反思转化为可诊断、可干预、可复核的学习证据链。

核心创新：

- 证据原生：所有诊断和建议都来自 EvidenceEvent，而不是凭空生成。
- 路径数字孪生：学习路径有状态、阻塞原因、完成证据和下一步行动。
- 可审计 GraphRAG：课程 Rubric、代码证据、AI 边界策略和反思记忆会显示命中原因。
- 评审证据映射：把官方评分维度、实现模块和提交材料直接连到同一张证据表。
- SafeVOI 策略：下一步建议同时考虑学习增益、风险、可逆性和证据覆盖。
- 学生对话：自然语言输入先经过意图识别、知识边界和安全门，再生成可追踪脚手架。
- 安全发布门：高风险、低置信或可能替写答案的建议进入教师复核。
- 权限隐私治理：真实试点前先验证角色最小权限、敏感字段扫描和越权请求拦截。
- API 集成契约：真实接入前先明确 API、Webhook、幂等、环境变量和 tenantId/courseId 隔离。
- 集成回放：把 API 契约变成可试运行的 Webhook 映射和 dead-letter 质量门。
- 模型实验治理：把算法注册表、实验协议、发布门和漂移监控作为持续迭代证据。
- AI Agent 运行时：把大模型接入、GraphRAG、工具调用和无 Key 降级做成可复核运行时。
- 推理网关与 GraphRAG 试验台：把真实模型接入做成后端密钥隔离链路，无 Key 时仍能稳定返回可复现脚手架。
- 学习增值评估：把“干预是否真的有价值”拆成能力增量、策略优势、风险拦截、教师工时和真实试点边界。
- 试点遥测与效果验证：把真实课程试点的数据契约、分组设计、效果指标、声明门禁和分析 Manifest 做成可执行研究闭环。
- 多租户上云运营：把学校租户、课程复制、权限矩阵、席位预算、SLO、Runbook 和回滚路径做成可执行的云端运营中心。
- 教师标注与 Rubric 校准：把教师锚点样本、一致性阈值、Rubric 漂移、真实效果声明门禁和可下载 Manifest 做成可信诊断中心，避免 AI 自评自证。
- 科研算法融合与开源证据：把开源参考、自研算法、研究假设、验证阶梯、论文提纲和答辩口径做成产品内证据中台。
- 教师周报：把学习闭环沉淀成教师可下载、可复盘、可分享的 Markdown 报告。
- 干预发布中心：把算法建议变成可发布行动包、教师复核工单、API 回写、回滚规则和禁止替写护栏。
- 课程开班向导：把课程配置、真实工具接入、教师复核和 AI 运行时变成首周开班 SOP。
- 评委任务包：把“点击哪里、看什么、对应哪个评分项、成功信号和兜底路线”产品化，降低现场评审理解成本。
- 评委 5 分钟实操演练：把评委现场操作、教师复核深潜、SLO 证据、技术验收、评分映射和真实性边界压缩为 300 秒机器可验路线，并提供一键导览模式让评委按步骤自动定位产品锚点。
- 比赛提交助手：把官方要求、材料包、源码 Demo、视频、发布门禁和平台文案整理成可提交清单。
- 视频与路演导演：把 3-5 分钟演示、旁白、评分证据、录制路线、导出素材和答辩风险口径做成产品内可执行镜头表。
- 最终上传与路演控制台：把正式上传路线、命名副本、提交当天流程、答辩锚点和禁止夸大口径做成最终人工门禁。
- 长期记忆：反思和教师复核会回写证据账本，形成可持续优化闭环。

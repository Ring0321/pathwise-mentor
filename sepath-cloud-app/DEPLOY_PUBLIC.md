# SE-Path 学伴公开试用部署说明

本文档用于把 `sepath-cloud-app` 发布成公开可访问的评委试用版本。当前应用不依赖真实学生数据、API Key 或外部数据库，适合先以静态前端方式上云。

## 一、推荐发布路径

### 1. 静态托管

```bash
npm install
npm run build
```

构建产物位于：

```text
dist/
```

把 `dist/` 整体上传到 Vercel、Netlify、Cloudflare Pages、OpenAI Sites 或学校静态服务器即可。若平台需要配置前端路由回退，请使用：

- Vercel：`vercel.json`
- Netlify：`netlify.toml`
- Nginx：`nginx.conf`
- Docker Compose：`docker-compose.yml`
- Docker 构建上下文：`.dockerignore`

### 2. Docker/Nginx

```bash
docker build -t sepath-cloud-app .
docker run --rm -p 8080:80 sepath-cloud-app
```

也可以直接执行：

```bash
docker compose up --build
```

访问：

```text
http://127.0.0.1:8080
```

## 二、评委试用包

项目根目录提供脚本：

```bash
python scripts/build_public_trial_bundle.py
```

该脚本会把最新 `dist/` 复制到：

```text
参赛提交材料包/公开试用静态包/
```

并生成 `PUBLIC_TRIAL_MANIFEST.json` 与 `README_公开试用.md`。如果正式提交平台允许上传补充文件，可以把该目录整体上传为“公开试用静态包”。

## 三、上线前验收

发布前至少执行：

```bash
npm run test
npm run build
npm run qa:screenshots
```

项目根目录执行：

```bash
python scripts/release_gate.py
python scripts/validate_deploy_artifacts.py --write
```

通过标准：

- 25 个算法测试全部通过。
- 生产构建通过。
- 桌面与移动端无横向溢出。
- 公开试用静态包生成成功。
- 提交包审计 FAIL 为 0。
- 学生对话实验台已覆盖自然语言求助、直接答案拦截、微行动追问和 EvidenceEvent 写回。
- 集成回放沙箱已覆盖 Git、CI、LMS、飞书 Webhook 的幂等、脱敏、契约匹配和 EvidenceEvent 映射。
- 课程配置与 Rubric Studio 已覆盖 Rubric、作业模板、AI 边界和课程 Manifest。
- 教师周报与试点复盘已覆盖学生阻塞、班级信号、下周行动、AI 边界和 Markdown 下载。
- 权限与隐私治理中心通过角色最小权限、敏感字段扫描和越权请求拦截检查。
- API 与集成契约中心已覆盖核心 API、Webhook、幂等键、环境变量和租户隔离。
- 学习增值评估中心已覆盖能力增量、SafeVOI 策略优势、可解释增值估计、真实试点 Telemetry Contract 和不可过度宣称边界。
- AI Agent 运行时与模型接入中心已覆盖模型路由、Prompt 契约、RAG 上下文包、工具 Trace、质量门和无 Key 降级。
- 课程开班向导已覆盖首周开班步骤、真实接入链路、课程启动包、风险登记和可导出 Manifest。
- 模型与实验治理中心已覆盖算法注册表、实验协议、发布门和漂移监控。
- 不包含真实学生隐私、API Key 或第三方平台凭据。

## 四、访问策略

比赛阶段可选择两种策略：

| 策略 | 适用场景 | 说明 |
| --- | --- | --- |
| owner-only 私有访问 | 内部验证、未公开路演 | 匿名访问返回 401/403 属于预期访问控制 |
| 公开只读访问 | 正式评审、线上路演 | 仅展示合成样本与可审计闭环，不采集真实个人信息 |

无论采用哪种策略，都不要在未确认前宣称已经接入真实学校、真实学生或真实成绩提升数据。

# SE-Path GitHub Actions Webhook 接入说明

本说明用于课程试点，把软件工程课程仓库中的 PR/CI 失败事件接入 SE-Path 教师工作台，生成“增值诊断单”。接入目标不是替学生写代码，而是把失败证据转成教师可复核的学习工单。

## 1. 教师工作台配置

在教师工作台打开“课程与仓库设置”，填写：

- 课程班级，例如 `软件工程 2301`
- 课程任务，例如 `REST API 错误处理与边界测试`
- 代码仓库，例如 `se-course/rest-api-lab`
- CI 提供方，例如 `GitHub Actions`
- 后端 API 地址，例如 `https://sepath-edge.example.com`

保存后，工作台会生成 Webhook 地址：

```text
https://sepath-edge.example.com/api/webhooks/github/ci
```

## 2. 后端环境变量

真实试点建议启用以下变量：

```text
SEPATH_AUTH_SECRET=<HMAC access-token secret>
SEPATH_GITHUB_WEBHOOK_SECRET=<GitHub webhook HMAC secret>
SEPATH_GITHUB_WEBHOOK_TOKEN=<legacy shared-token fallback, optional>
SEPATH_PRIVACY_MODE=pseudonymous
SEPATH_DB=<D1/SQLite-compatible binding>
```

`SEPATH_DB` 对应的数据库需先执行：

```text
cloud/sql/004_workbench_runtime_store.sql
```

## 3. GitHub 仓库配置

在课程仓库 Settings 中添加：

- Repository Variable: `SEPATH_WEBHOOK_URL`
- Repository Secret: `SEPATH_WEBHOOK_SECRET`
- 可选 Repository Variable: `SEPATH_LEARNER_HASH`

然后把示例文件复制到课程仓库：

```text
.github/workflows/sepath-ci-evidence.yml
```

示例文件位于：

```text
cloud/examples/github-actions-sepath-ci-evidence.yml
```

## 4. 验收方式

1. 学生提交一个会导致 CI 失败的 PR。
2. GitHub Actions 运行失败后，使用 `SEPATH_WEBHOOK_SECRET` 对脱敏 JSON 生成 `x-hub-signature-256`，再向 `/api/webhooks/github/ci` 发送事件。
3. 教师工作台刷新今日队列，看到新的“增值诊断单”。
4. 教师打开诊断单，查看证据覆盖、缺失证据、Safe-VOI 建议。
5. 教师选择“批准脚手架 / 退回补证据 / 转人工会谈”。
6. 学生从回流入口提交补充证据和反思。
7. 证据账本生成闭环记录，并可导出 JSON 证据包。

## 5. 安全边界

- 只传 `learnerHash`，不传姓名、邮箱、手机号、token、原始日志、完整代码 diff。
- CI 日志只传摘要，不传完整日志。
- 生产试点优先使用 GitHub HMAC 签名；`x-sepath-webhook-token` 只作为旧脚本兼容方式。
- AI 只形成候选建议，教师确认后才生效。
- 增值评价只用于形成性诊断和资源推荐，不用于排名、惩罚或就业预测。

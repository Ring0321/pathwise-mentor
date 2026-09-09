# SE-Path 学伴云端应用原型

SE-Path 学伴是面向软件工程项目式学习的自适应学习伙伴智能体。当前工程是一个可本地运行、可静态上云部署的 React/Vite 应用，已经实现最小闭环：

1. 学生提交失败 PR/CI 事件。
2. 系统写入证据账本。
3. 诊断 Agent 生成诊断卡。
4. SafeVOI 策略选择下一步行动。
5. 脚手架 Agent 拒绝替写完整答案，只给检查清单。
6. 教师复核台处理高风险建议。
7. 学生修复、CI 通过、提交反思，路径数字孪生更新。

## 本地运行

```bash
npm install
npm run dev
```

默认本地地址：

```text
http://127.0.0.1:5188
```

## 验证

```bash
npm run test
npm run build
npm run qa:screenshots
```

`qa:screenshots` 会通过本机 Chrome DevTools Protocol 抓取桌面与 390px 移动端截图，并校验页面已经挂载、没有横向滚动溢出。截图输出在 `qa/screenshots/`。

## 上云方式

- 静态托管：执行 `npm run build` 后部署 `dist/`。
- 公开试用包：在项目根目录执行 `python scripts/build_public_trial_bundle.py`，生成 `参赛提交材料包/公开试用静态包/`。
- Vercel：使用 `vercel.json`，输出目录为 `dist`。
- Netlify：使用 `netlify.toml`，发布目录为 `dist`。
- Docker：执行 `docker build -t sepath-cloud-app .`，再部署 Nginx 镜像。
- 后端扩展：把 `src/engine` 中的确定性算法迁移到 API 服务，前端仅保留状态展示和操作。

## 参赛演示路线

依次点击主按钮完成六步演示：提交失败 PR、学生请求完整代码、推送脚手架提示、学生修复并通过 CI、教师复核放行、生成反思记忆。

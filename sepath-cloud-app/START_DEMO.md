# START DEMO

## 一键本地演示

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:5188
```

## 六步闭环点击顺序

1. 提交失败 PR。
2. 学生请求完整代码。
3. 推送脚手架提示。
4. 学生修复并通过 CI。
5. 教师复核放行。
6. 生成反思记忆。

每点击一步，证据账本、诊断卡、路径数字孪生、SafeVOI 决策、教师复核台和可观测追踪都会同步更新。

## 生产构建

```bash
npm run test
npm run build
```

构建产物位于：

```text
dist/
```

可直接部署到 Vercel、Netlify、Cloudflare Pages、OpenAI Sites、静态服务器或 Docker/Nginx。

项目根目录还可以生成公开只读试用包：

```bash
python scripts/build_public_trial_bundle.py
```

输出目录：

```text
参赛提交材料包/公开试用静态包/
```

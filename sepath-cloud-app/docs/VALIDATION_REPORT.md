# 当前验证报告

验证日期：2026-08-09

## 验证范围

本报告验证当前 `sepath-cloud-app` 是否具备可运行、可测试、可生产构建的基础条件。它不证明真实课程学习效果，也不证明真实用户增长或 ROI。

## 已执行命令

```bash
npm run test
npm run build
npm run qa:screenshots
```

## 结果

| 项目 | 结果 |
| --- | --- |
| Vitest 测试文件 | 1 个通过 |
| 测试用例 | 5 个通过 |
| TypeScript 编译 | 通过 |
| Vite 生产构建 | 通过 |
| 本地服务访问 | 固定使用 `http://127.0.0.1:5188`，避免与其他项目默认 Vite 端口冲突 |
| 桌面截图 QA | 通过，`1440x1024`，`docScroll=1425`、`docClient=1425` |
| 移动端截图 QA | 通过，`390x900`，`docScroll=390`、`docClient=390` |

## 视觉与视口证据

- 桌面截图：`qa/screenshots/desktop-viewport.png`
- 移动端截图：`qa/screenshots/mobile-viewport.png`
- 截图脚本：`npm run qa:screenshots`
- QA 判定：页面必须挂载 `.app-shell`，且 `documentElement.scrollWidth <= clientWidth + 1`，否则脚本失败。

## 测试覆盖的关键行为

- CI 失败会被诊断为测试相关阻塞。
- SafeVOI 会阻断高风险、不可逆或低信息增益的行动。
- 学生请求完整代码时，脚手架模块会拒绝替写。
- 高风险建议会进入教师复核。
- Demo 事件流可以逐步推进。

## 未验证内容

- 尚未接入真实 GitHub/GitLab/LMS。
- 尚未接入真实 LLM、GraphRAG 或向量数据库。
- 尚未完成真实云部署。
- 已用 Chrome DevTools Protocol 做桌面/移动端截图 QA；后续还需要录屏级交互 QA。
- 尚未进行真实学生试点。

## 下一步验证

1. 用 Playwright 或浏览器截图检查桌面和移动端布局。
2. 增加端到端测试：点击六步 Demo 按钮后检查证据、诊断、复核状态。
3. 增加敏感词/直接答案红队样例。
4. 生成最终提交 ZIP 并做大小、敏感信息和启动说明检查。

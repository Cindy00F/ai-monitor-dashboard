# Cindy00F GitHub Monitor

一个面向 Cindy00F 公开 GitHub 活动的轻量监控台。它保留了黑色玻璃卡片和动态图表的视觉，但卡片不再播放随机演示：仓库规模、Actions 状态、近期事件、提交采样和雷达维度都来自构建时生成的静态数据。

## 数据怎么来

GitHub Actions 每小时运行一次 `scripts/collect-github-stats.mjs`，使用工作流自带的 `GITHUB_TOKEN` 读取 Cindy00F 的公开仓库，并在构建期间生成 `public/data/github-stats.json`。JSON 随 Pages artifact 一起发布，不会提交回仓库，也不会把 token 写入网页。

当前口径：

- 遍历账号下全部公开仓库，支持 All repositories 和单仓库筛选。
- 每个仓库读取最近 30 条 Actions runs；安全卡展示失败、进行中和整体健康状态。
- 提交热力图统计最近 56 天、每仓库最多 100 条由 Cindy00F 创作的公开 commit。这是 API 采样，不冒充 GitHub 官方 contribution 数字。
- 时间轴读取最多 3 页公开用户事件，仅保留 push、PR、review、issue、release 和 create。
- 雷达将提交采样、PR/review 事件、issue 事件和 Actions 成功率归一化为 0–100，适合看活动结构，不用于绩效比较。
- 仓库规模来自 GitHub API 的 `size`（KB），像素矩阵表示当前筛选范围相对最大仓库的规模。

页面会显示更新时间、来源和 stale 状态。“Refresh data”只重新获取已部署 JSON；“Run collector”会打开 GitHub Actions 页面，由有权限的用户手动触发 workflow。静态 Pages 不会假装可以直接重跑 workflow 或修改 issue。

## 本地数据

仓库内保留一份真实结构的 fallback snapshot，方便无凭据开发。没有 `GH_TOKEN` 时，`npm run collect` 会明确提示并保留它；提供 token 后会实时采集，任何 API 错误都会让命令失败。

Windows PowerShell：

```powershell
cd C:\Users\320305970\Downloads\ai-monitor-dashboard
$env:GH_TOKEN="your_token" # 可选，仅采集实时公开数据时需要
npm.cmd install
npm.cmd run collect
npm.cmd run dev
```

Windows 使用 `npm.cmd`，可绕过部分系统对 `npm.ps1` 的 PowerShell 执行策略限制。

macOS Terminal：

```bash
cd ~/Downloads/ai-monitor-dashboard
export GH_TOKEN="your_token" # 可选，仅采集实时公开数据时需要
npm install
npm run collect
npm run dev
```

## 检查与 production preview

Windows PowerShell：

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run preview
```

macOS Terminal：

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

GitHub Pages 可在 Actions 中通过 **Run workflow** 手动刷新；无人工操作时，计划任务会在每小时第 17 分钟重新采集并部署。

# AI Monitor Dashboard

一个以系统状态和协作数据为主题的动态监控台。页面采用纯黑背景与深色玻璃卡片，桌面端保持紧凑的 3+2 布局，在窄屏上会自动重排。

监控台包含倒计时与分段进度、安全状态切换、容量像素矩阵、日程时间轴，以及贡献热力图和雷达图。数字、方块、扫描线与状态提示会自动循环变化；鼠标悬停时也有细节反馈。系统开启“减少动态效果”后，动画会自动降级。

## Windows PowerShell

```powershell
cd C:\Users\320305970\Downloads\ai-monitor-dashboard
npm.cmd install
npm.cmd run dev
```

生产构建与本地预览：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run preview
```

这里使用 `npm.cmd`，是为了绕过部分 Windows 环境对 `npm.ps1` 的 PowerShell 执行策略限制。

## macOS Terminal

```bash
cd ~/Downloads/ai-monitor-dashboard
npm install
npm run dev
```

生产构建与本地预览：

```bash
npm run typecheck
npm run build
npm run preview
```

开发服务默认运行在 `http://localhost:5173`，预览服务默认运行在 `http://localhost:4173`。

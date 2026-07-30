# 纸上游戏厅 / Iron Recoil

这是一个可安装、可离线运行的轻量 PWA 游戏合集。最新游戏 **Iron Recoil**
是一款从零实现的原创 2D 横版跑枪救援游戏：玩家进入被机械军团占领的工业港，
穿过三个战斗区域，营救三名工人，并摧毁 Boss“移动钻探机”。

Iron Recoil 的角色、敌人、世界观、关卡、UI、程序图形与合成音效均为本项目原创，
未使用、提取或临摹任何商业游戏素材。项目只借鉴“移动、跳跃、射击、营救、Boss 战”
等通用玩法概念。

## 安装与运行

需要 Node.js 22.13 或更新版本以及 npm。

```bash
npm install
npm run dev
```

打开终端输出的网址，再进入 `/iron-recoil`。游戏无需后端，`npm run build`
生成可供静态/边缘托管使用的生产产物。

## 操作

| 按键                   | 功能         |
| ---------------------- | ------------ |
| `A` / `D` 或 `←` / `→` | 左右移动     |
| `W`                    | 向上瞄准     |
| `S`                    | 下蹲         |
| `Space`                | 跳跃         |
| `J`                    | 射击         |
| `K`                    | 投掷爆炸物   |
| `E`                    | 营救附近工人 |
| `Escape`               | 暂停 / 继续  |
| `Enter`                | 开始 / 确认  |

跳跃支持输入缓冲和 coyote time。基础脉冲步枪无限弹药；关卡内可拾取散射武器、
重型连发武器和医疗包。有限弹药耗尽后会自动切回基础武器。

## 开发命令

```bash
npm run dev          # 本地开发
npm run build        # 生产构建
npm run preview      # 预览生产版本
npm run typecheck    # Iron Recoil 严格 TypeScript 检查
npm run lint         # ESLint
npm run format       # Prettier 写入格式
npm run test         # 单元测试 + 服务端渲染测试
npm run test:e2e     # Playwright 浏览器游玩回归
npm run check        # typecheck + lint + unit test + build
```

`tsconfig.iron-recoil.json` 启用了 `strict`、`noImplicitAny`、
`noUncheckedIndexedAccess` 和 `exactOptionalPropertyTypes`。端到端测试在开发模式
使用 `window.__IRON_RECOIL_TEST_API__`；生产构建不会暴露该接口。

## PWA 与离线

首次在线加载成功后，Service Worker 会缓存游戏路由、清单和图标。浏览器菜单或标题栏
安装入口可将 Iron Recoil 安装为独立应用。开发环境会主动注销 Service Worker，
避免旧缓存干扰调试；发布版本使用带版本号的缓存并清理旧缓存。

## 浏览器支持

面向当前稳定版 Chrome、Edge、Firefox 和 Safari 桌面浏览器。推荐硬件加速和实体键盘。
Web Audio 会在首次用户操作后解锁，符合浏览器自动播放限制。设置只存入当前设备的
`localStorage`，项目不接入广告、分析、账号或数据采集。

## 测试

单元测试覆盖伤害、无敌时间、弹药消耗与回退、范围伤害、重复营救保护、Boss 阶段阈值
和设置恢复。Playwright 覆盖页面加载、无未处理异常、进入游戏、移动、跳跃、射击、
暂停/继续、失败重启、Boss 跳转、胜利结算及重启后的实体状态清理。

## 当前限制

- 首版仅支持桌面键盘，触屏和手柄输入保留为后续扩展点。
- 只有一个关卡；检查点记录已纳入运行时结构，但 MVP 采用整关快速重开。
- 美术和音频为低成本原创程序占位效果，暂无背景音乐。
- Phaser 运行包较大，生产构建会报告单个异步游戏块超过 500 kB 的性能提示。
- 离线测试依赖生产模式；开发模式刻意禁用缓存。

架构细节见 [ARCHITECTURE.md](./ARCHITECTURE.md)，游戏设计见
[GAME_DESIGN.md](./GAME_DESIGN.md)，第三方审计见
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

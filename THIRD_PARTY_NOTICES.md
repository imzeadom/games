# Third-Party Notices

## Assets

Iron Recoil 未使用第三方图片、sprite、字体、音乐、音效、地图或动画素材。
游戏画面由运行时 Phaser Graphics 和仓库内原创 CSS 几何图形生成；音效由 Web Audio API
在运行时合成；`icon-iron-recoil.svg` 为本项目原创图标，未基于第三方作品。

## Principal software dependencies

| 名称            | 版本   | 用途                            | 许可证     | 修改 |
| --------------- | ------ | ------------------------------- | ---------- | ---- |
| Phaser          | 4.2.1  | 游戏渲染、输入和 Arcade Physics | MIT        | 否   |
| React           | 19.2.6 | DOM UI 与 HUD                   | MIT        | 否   |
| Next.js         | 16.2.6 | 路由与页面结构                  | MIT        | 否   |
| Vite            | 8.0.13 | 开发与构建                      | MIT        | 否   |
| Vitest          | 4.1.10 | 单元测试                        | MIT        | 否   |
| Playwright Test | 1.62.0 | 浏览器端到端测试                | Apache-2.0 | 否   |
| TypeScript      | 5.9.3  | 静态类型检查                    | Apache-2.0 | 否   |

完整传递依赖及其许可证以 `package-lock.json` 和各 npm 包内许可证文件为准。
本表记录 Iron Recoil 直接依赖或开发流程中的主要第三方软件，不表示对其商标的认可或关联。

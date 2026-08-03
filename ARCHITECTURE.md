# Iron Recoil Architecture

## 场景结构

`app/iron-recoil/page.tsx` 负责可访问的 DOM 界面、HUD、设置与 Phaser 容器。
`game/bootstrap.ts` 只负责创建和销毁 Phaser 实例。`IronRecoilScene` 协调物理、
镜头、输入和各系统，不持有 React 状态；它以 10 Hz 发布不可变 `GameSnapshot`，
减少跨渲染器同步成本。

标题、暂停、失败和胜利页面由 DOM 渲染，关卡与角色由 480×270 的 Phaser 画布渲染。
画布使用整数逻辑尺寸、`pixelArt`、`roundPixels` 和 nearest-neighbour 缩放。

## 实体架构

玩家是独立运行时对象。敌人使用 `EnemyRuntime` 数据和 `EnemyKind` 配置组合行为，
没有臃肿继承树。巡逻机器人、跳跃爬行机器人、固定炮台和飞行侦察机共用小型状态字段：
`idle`、`patrol`、`alert`、`attack`、`hurt`、`dead`。

工人、拾取物和可破坏物分别使用小型运行时记录。所有数值位于 `game/config.ts`，
出生点、平台、区域、拾取物和环境物体位于 `game/level.ts`。

## 战斗系统

`game/model.ts` 提供无 Phaser 依赖的纯函数：伤害/无敌、弹药、自动武器回退、范围伤害、
营救去重和 Boss 阶段计算。玩家与敌方弹丸使用有上限的 Phaser Arcade Group 对象池；
越出镜头的弹丸立即回收。爆炸按距离衰减伤害。

三种武器共享配置化射速、伤害、弹速、弹丸数和散布。Boss 根据生命比例切换机关炮、
地面震荡波、危险物投放/维修无人机三个模式。

## 输入系统

键位在一个 `ControlKeys` 映射中集中创建。移动读取持续状态；跳跃、射击、爆炸物、
营救和暂停同时使用按下事件队列，避免快速点击落在两个逻辑帧之间而丢失。
输入层可在后续加入触屏和手柄适配器而不改战斗模型。

## 关卡数据

`LEVEL` 是只读 TypeScript 数据对象，描述四个区域、八个平台、十二个初始敌人、
三名工人、三种拾取物和四个可破坏物。普通敌人超过镜头宽度加安全边距后停止昂贵逻辑。
Boss 区域触发后锁定镜头边界。

## 对象生命周期

场景关闭时移除键盘和游戏事件监听器；弹丸池、物理碰撞器、延迟事件和场景对象由 Phaser
场景生命周期清理。重启前 `resetRuntime()` 重置武器、工人、Boss、队列、特效和计数，
重建完成后才发送 `iron:restarted`，防止调用方观察到半重置状态。Boss 死亡设置独立
`bossDefeated` 闩锁，并清空敌方弹丸，禁止区域触发器或延迟攻击再次生成伤害对象。

## 音频、设置与 PWA

`SynthAudio` 在首次交互后创建/恢复 `AudioContext`，用短振荡器包络生成原创占位音效。
静音、音量、屏幕震动、减少动态效果和 debug overlay 设置保存在 `localStorage`。
生产环境注册版本化 Service Worker，开发环境注销它。

## 测试接口

仅非生产模式暴露 `window.__IRON_RECOIL_TEST_API__`，可读取快照、开始/重启任务、设置生命、
跳转区域、伤害 Boss、营救全部工人并查询实体数。接口返回数据而不是依赖截图像素，
使 Playwright 断言稳定。

## 扩展建议

- 将输入读取抽象为 keyboard/touch/gamepad 多适配器。
- 将敌人更新拆为可复用感知、移动和攻击组件，支持更多关卡数据。
- 把关卡数据迁移到版本化 JSON 或 Tiled 导出格式，并加入关卡编辑校验。
- 多人模式使用确定性战斗模型与输入帧同步；渲染层继续保持客户端独立。

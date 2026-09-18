# CONTRACT.md —— 「白骨迎宾道」模块合同（所有开发必读，违反即返工）

经典 script 加载（无 ES module，`file://` 也能跑）。每个 js 文件是 IIFE，
挂到 `window.GAME` 命名空间；在 node 里 `root = globalThis`（用于无头测试）：

```js
(function (root) {
  'use strict';
  root.GAME = root.GAME || {};
  root.GAME.XXX = ...;
})(typeof window !== 'undefined' ? window : globalThis);
```

加载顺序（index.html 固定）：`config → engine → fx → audio → render → input → ui → main`

## 文件所有权（只许动自己的文件）

| 负责人 | 文件 |
|---|---|
| 制作人 | `index.html` `css/` 目录占位 `js/config.js` `dev-server.mjs` `package.json` 本文件 |
| 玩法程序 | `js/engine.js` `js/main.js` |
| 表现程序 | `js/render.js` `js/fx.js` `js/audio.js` |
| UI 程序 | `js/ui.js` `js/input.js` `css/style.css` |

**`js/engine.js` 和 `js/config.js` 必须 DOM 安全**：不引用 `document`，QA 会在 node 里直接加载跑无头试玩。其余文件随便用浏览器 API。

## 坐标约定

- 引擎内部一律用**格坐标**（浮点），`(x, y)` = (列, 行)， tile 中心为 `(c+0.5, r+0.5)`。
- 渲染层乘 `CONFIG.TILE` 换算像素。
- 地图字符语义见 `config.js` 顶部注释。`:`（密道）在挖掘完成前**不可通行**；`#`（骨墙）在 hp 归零前不可通行；`%`、`D` 不可通行（`D` 是攻击目标）；其余字符均可通行。
- 距离用欧式距离（格）。

## 引擎公开 API（GAME.Engine）

```js
const game = GAME.Engine.createGame();
game.state          // 见下方形状
game.events         // 数组，每帧由 main.js 取出并清空，分发给 FX/Audio/UI
game.update(dt)     // dt 秒，main.js 固定步进调用
// 指令（全部返回 { ok: boolean, msg?: string }，失败时 push 'cmd-denied' 事件）：
game.spawnUnit(type)        // 'ghoul'|'archer'|'troll'|'apostle'，扣魂能，从 S 点入场
game.cmdMove(ids, x, y)     // ids: number[]
game.cmdAttack(ids, targetId) // targetId: 塔/骨墙('wall')/亡者之门('gate')/骷髅 id
game.cmdDig(ids)            // 仅食尸鬼；走到挖掘点旁读条
game.cmdSeal(ids)           // 任意兵种；走到裂隙旁读条，被打断（受伤/移动/死亡）重来
game.castLord()             // 领主技能「尸潮」，冷却中返回 ok:false
// 查询助手（渲染/输入层要用）：
game.tileChar(cx, cy)       // 原始地图字符
game.isWalkable(cx, cy)
game.findPath(sx, sy, tx, ty) // 返回 [{x,y}...] 格中心点序列
game.towerAt(cx, cy)        // 该格是否有活塔/墙/门 → 实体或 null
game.unitAt(px, py, r)      // 点选
game.unitsInRect(x0, y0, x1, y1) // 框选（格坐标矩形）
```

### state 形状（渲染/UI 只读）

```js
state = {
  time, phase: 'battle'|'won'|'lost',
  soul, kills,
  lord: { x, y, hp, maxHp, abilityCd },          // abilityCd 剩余秒
  units: [{ id, type, name, x, y, hp, maxHp, speed,
            state: 'idle'|'move'|'attack'|'channel'|'fear'|'dead',
            targetId, channel: null|{kind:'dig'|'seal', t, need},
            fearT, slowT, atkCd, onHigh }],
  skeletons: [{ id, x, y, hp, maxHp, state, atkCd }],
  towers: [{ id, key, name, x, y, hp, maxHp, range, alive, atkCd }],
  projectiles: [{ id, x0,y0,x1,y1, t, dur, kind:'bone'|'poison', hit }], // 表现用
  wall:  { id:'wall', tiles:[[r,c]...], cx, cy, hp, maxHp, alive },
  gate:  { id:'gate', tiles:[[r,c]...], cx, cy, hp, maxHp, alive },
  rift:  { id:'rift', x:38.5, y:21.5, sealed, progress },  // progress 0..1 读条
  dig:   { id:'dig',  x:34.5, y:18.5, opened, progress },
  tombPoints: [[r,c]...],
  tutorialSeen: { tutId: true },
  stats: { towersDown, skeletonsKilled, soulEarned },
}
```

### 事件类型（`game.events` 元素： `{ type, ...payload }`）

`unit-spawn{unit}` `unit-die{unit}` `skeleton-rise{skel,x,y}` `skeleton-die{skel}`
`hit{x,y,amount,kind:'unit'|'tower'|'wall'|'gate'|'skel',crit}`
`tower-down{tower}` `wall-break{}` `gate-down{}`
`dig-start{}` `dig-done{}` `ambush{wave,x,y}` `seal-start{}` `seal-done{}`
`fear{x,y}` `lord-ability{}` `soul-change{delta,soul}`
`tutorial{id,text}` `cmd-denied{msg}` `win{}` `lose{}`

### 玩法规则要点（引擎必须实现，数值全在 config）

1. 我方单位静止时自动攻击射程内最近敌人（塔/墙/门/骷髅）；`cmdAttack` 指定目标后追击至射程内。
2. 射手站 `^` 格射程 +2；哀嚎尖塔本身在 `^` 上，射程用 `highRange`。
3. 毒塔：射程内所有我方单位持续掉血 + 减速；毒沼 `~` 同理（使徒免疫二者）。
4. 哀嚎尖塔每 4 秒脉冲：射程内非免疫单位恐惧 2 秒（朝入口逃跑，不可控）。
5. 复活塔每 6 秒（封印后 12 秒）在射程 4 内补足骷髅至 3 只，事件 `skeleton-rise`。
6. 挖掘：食尸鬼在 `?` 旁读条 5 秒 → `:` 全部变可通行 + 触发 2 波伏击（从离密道出口 `(14,41)` 最近的墓碑爬出，波间隔 6 秒）。
7. 封印：任意单位在 `X` 旁读条 8 秒，受伤/移动/死亡即打断 → 复活间隔翻倍、全塔攻速 -15%、+80 魂能。
8. 撞破骨墙：立即从墓地墓碑刷 6 只骷髅（惊动）。
9. 巨魔对塔/墙/门伤害 ×3，免疫恐惧。
10. 骷髅 AI：追最近我方单位；无我方存活单位时冲向领主。
11. 胜负：`gate.hp<=0` → `win`；领主 hp<=0 或（全场无我方单位且魂能 < 25）→ `lose`。
12. 教学事件触发点：单位首次进箭塔射程 `tut-tank`；射手首次站上高地 `tut-high`；单位首次中毒 `tut-range`；首次下达对骨墙攻击或撞上 `tut-wall`；复活塔首次复活 `tut-aoe`；单位首次接近裂隙 6 格内 `tut-rift`。
13. 寻路：A* 或 BFS，4 向；骨墙破/密道开后必须重算（版本号失效缓存）。

## 表现程序 API

- `GAME.Render.init(canvas, game)`；`GAME.Render.draw()` 每帧调用（读 `game.state` 与 `GAME.Input.state`）。
- `GAME.FX.init(game)`；`GAME.FX.handleEvent(e)`；`GAME.FX.update(dt)`；`GAME.FX.drawOverlay(ctx)`（粒子/伤害数字/屏幕震动偏移由 FX 内部管理，Render 在 draw 开头调用 `GAME.FX.applyShake(ctx)`）。
- `GAME.Audio.init()`（首次用户手势时调用）；`GAME.Audio.handleEvent(e)`；`GAME.Audio.setEnabled(bool) → bool`。WebAudio 合成，禁止外部音频文件。

## UI 程序 API

- `GAME.UI.init(game)`：填充 `#unit-cards` 兵种卡（图标/名/价/快捷键/描述 tooltip），绑 `#lord-ability`、`#btn-restart`、`#btn-audio`、`#btn-overlay-restart`。
- `GAME.UI.update()`：每帧刷新魂能/计时/领主血条/技能冷却/选中信息 `#selection-info`。
- `GAME.UI.handleEvent(e)`：教学与事件 toast 进 `#toasts`（每条教学全关一次）；`win/lose` 时填 `#overlay` 并去掉 `hidden`。
- `GAME.Input.attach(canvas, game)`：左键点选/框选，右键智能指令（点敌人=攻击，点 `?`=挖掘，点 `X`=封印，其余=移动），快捷键 1-4 出兵、Q 领主技能。
- `GAME.Input.state = { selectedIds: Set<number>, hoverTile: {x,y}|null, dragRect: null|{x0,y0,x1,y1}, orderMarker: null|{x,y,t,kind} }`（Render 读取）。

## main.js（玩法程序）

初始化所有模块 → rAF 循环：固定步进 `game.update` → 排空 `game.events` 分发给 FX/Audio/UI → `FX.update` → `Render.draw` → `UI.update`。`window.game = game`（调试/QA 用）。`#btn-restart` 与 `#btn-overlay-restart` 通过 `location.reload()` 重开。

## 美术基准（渲染/UI 必须遵守，色值一律从 CONFIG.PALETTE 取）

暗橄榄墓园底；骨白=亡灵建筑；毒绿=毒/鬼火；灵魂青=裂隙/魂能；赤陶=我方；金=强调；橙=选中/悬停。
动效：命中白闪、伤害数字上浮、读条画扇形环、死亡碎骨粒子、破墙/破门震屏、选中四角括号、`?`/`X` 两秒呼吸脉冲。
字体栈：`-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`。中文禁止斜体。

## 验收底线

- `node --check` 每个 js 文件必须通过。
- 首屏无账号无弹窗，打开即战场；教学内容只 toast，不挡操作。
- QA 无头脚本（node 直载 engine）必须能通关：模拟分兵进攻最终 `win`。

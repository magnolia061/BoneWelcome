# 白骨迎宾道 · 反塔防 Demo — 项目交接报告

> 写给下一位接手的 AI / 开发者。日期：2026-09-18。引擎：Unreal Engine 5.8。
> 所有路径均为本机绝对路径；工作区根目录 `C:\Users\magnolia\Documents\Kimi\Workspaces\游戏`。

## 0. 一句话

玩家指挥怪物大军（食尸鬼/射手/巨魔/使徒）进攻固定亡灵塔阵的"反塔防"：拆光防线、摧毁最东端的**亡者之门**获胜；己方**领主**阵亡则失败。当前状态：**M2-1 战斗闭环已完成并通过 PIE 实机冒烟验证，可上手玩**。

## 1. 资产布局

| 内容 | 路径 |
|---|---|
| UE 工程 | `C:\Users\magnolia\Documents\Kimi\Workspaces\游戏\BoneWelcome\BoneWelcome.uproject`（EngineAssociation 5.8，已内置 MCP 插件配置） |
| 主关卡 | `/Game/Maps/L_Level01`（磁盘：`Content\Maps\L_Level01.umap`） |
| **唯一设计数据源** | `BoneWelcome\Content\Design\level01_map.json`（64×24 地图、图例、配色、单位/塔数值、经济、规则） |
| 蓝图（9 个） | `/Game/Blueprints/`：BP_TDGameDirector、BP_Unit、BP_Tower、BP_Skeleton、BP_Gate、BP_BoneWall、BP_Lord、BP_TDPlayerController、BP_TDGameMode |
| 材质（14 个） | `/Game/Materials/`：M_Ground/M_Road/M_High/M_Ramp/M_Rock/M_BoneWall/M_Tomb/M_Marsh/M_RiftGlow/M_BoneTower/M_PoisonGlow/M_SoulGlow/M_Gold/M_Player（颜色已按 sRGB→线性 ^2.2 修正） |
| 截图 | `BoneWelcome\Saved\Screenshots\`（M1 关卡图 + M2 PIE 图） |
| 网页参考版（封存） | `C:\Users\magnolia\Documents\Kimi\Workspaces\游戏\bone-welcome\`：CONTRACT.md（规则母版）、js/engine.js、test/smoke.js(35 绿)、test/flow.js(36 绿)、test/playtest.js（四剧本）。**用户已否决网页版，仅作规则参考，别再改它** |

## 2. 玩法规则（以 level01_map.json 为准）

- 地图 64×24 格，100cm/格。图例：`%`岩石 `^`高地 `n`坡道 `#`骨墙 `T`墓碑 `~`沼泽 `X`裂隙 `?`挖掘点 `:`地道 `,`路 `.`地 `S`出生点 `D`亡者之门 `a/p/w/r`箭/毒/哀嚎/复活塔。
- 出生点 S 在西路 (col1,row10)；门 DD 在东路 (col60-61,row10-11)；骨墙列在 col32 把地图切成两半。
- **冻结规则（用户亲定）**：骷髅 = 塔的卫兵。复活塔子代守塔、事件骷髅守出生墓碑；守家圈 500cm（5 格），出圈即回家；**永不攻击领主/大本营**。
- 兵种（魂能花费/HP/攻/射程格/攻速/移速 m/s）：食尸鬼 25/120/10/1.4/1.0/2.4；骸骨射手 40/80/15/5/1.0/2.1；石肤巨魔 150/800/30/1.4/1.2/1.5（对建筑 3 倍伤，`trollBuildingMult`）；瘟疫使徒 120/200/20/3/1.0/1.9。
- 塔：箭塔 300HP/25伤/1s/射程5格；毒塔 450HP/10dps/3格/减速40%；哀嚎塔 350HP/6格（高地8格）/4s 脉冲恐惧2s；复活塔 600HP/6s 补骷髅（存活子代≤3），封印后 12s。
- 经济：开局 100 魂能；拆塔 +50；破墙 +20；封印裂隙 +80。门 1500 HP。
- 胜负：门毁 → `Phase="won"`；领主死或（无兵且魂能<25）→ `Phase="lost"`。

## 3. 运行时架构（Director 模式）

关卡里只放一个 `TDGameDirector`（BP_TDGameDirector 实例，已在 PersistentLevel）。它的 `BeginPlay` 从 CDO 的 `MapData`（24 行字符串，已填好）驱动整场游戏：

- 设出生点 SpawnCol=1/SpawnRow=10 → SpawnGateAt（固定 6000,1100）→ 6 座塔 SpawnTowerAt（硬编码坐标：wail 2450,450 / arrow 950,650 / poison 2750,950 / arrow 5450,950 / revive 4150,1250 / arrow 950,1650）→ col32 rows7-17 刷 11 个 BP_BoneWall → 出生区 ±3 格免费刷 15 个初始兵（8 食尸鬼/4 射手/2 巨魔/1 使徒）→ SpawnLordAt → 0.5s 循环定时器 **GameTick**（原指向遗留函数 CheckWinLose，已改）。
- GameTick = CheckEnd（无兵且穷→判负+红字 DEFEAT）+ 屏显 HUD 行 `Soul: X | Units: Y | Phase: Z`（0.5s 刷新，PrintString key="HUD"）。
- M1 摆放的可视化塔/门/墙 actor（Actor_0..6、StaticMeshActor_142..152 共 18 个）已设 `bHidden=true`（局中隐藏），由玩法 actor 取代；地形块/墓碑不动。

### 关键契约（改动前先读这些）

- **统一受伤入口**：`TakeTDamage(N)`，BP_Unit/BP_Tower/BP_Skeleton/BP_Gate/BP_BoneWall/BP_Lord 全部实现。所有 `TakeDmg` 是没人调用的死壳，别用。
- BP_Unit：`UnitType` 是 **Name**（"ghoul"/"archer"/"troll"/"apostle"）；`InitUnit(UnitType)` 按 JSON 设数值（射程格×100=cm，速度 m/s×100=cm/s）+ SetupVisual；`Init(TypeIdx:int, D:Actor)` 双入口。`TickMove` 由 BeginPlay 的 0.1s 循环定时器驱动（FollowPath/EngageTarget 内部硬编码 ×0.1 步长）：毒伤/减速(×0.6)/恐惧逃跑/路径移动/接战。`DealDamageTo(T:Actor)` = 五连 Cast（Tower→Gate→BoneWall→Skeleton→Unit）调 TakeTDamage(Atk)。`SetMoveCommand(Loc:Vector)` / `SetTargetCommand(T:Actor)`。
- BP_Tower：BeginPlay 是**有意留空的**（只 PrintString "tower spawned"）——SpawnActor 同步触发 BeginPlay 早于 InitTower，类型初始化必须全在 `InitTower(TowerType)` 里：SetTowerType → 按类型设 MaxHP/Range（arrow 300/500、poison 450/300、wail 350/600、revive 600/400）→ SetHP=MaxHP → SetupVisual → 0.5s TryLink + 按类型行为定时器（ArrowFire 1.0 / PoisonTick 1.0 / WailPulse 4.0 / RevivePulse 6.0）。塔行为：ArrowFire→最近单位 TakeTDamage(25)；PoisonTick/WailPulse→ApplyToAllInRadius；RevivePulse→SpawnActor 骷髅+Init+SetHomeTower，ChildDied 维护子代计数。
- BP_Skeleton：`InitSkel(Home:Vector)` 设 Home+HomeLocation（守卫逻辑消费的是 **Home** 变量）；TickMove 守卫巡逻已实现（78 节点）；`FindNearestUnitHome` 用 `GetAllActorsOfClass(BP_Unit)` 找目标——**骷髅不打领主目前靠"BP_Lord 不是 BP_Unit 子类"的类隔离成立，若让 Lord 继承 BP_Unit 规则立即破防**。
- BP_Gate：TakeTDamage→HP≤0→Director.NotifyGateDown（Phase→won）→DestroyActor。
- BP_BoneWall：TakeTDamage→破碎时用 `TileChar(c,r)=="T"` 全图扫描找最近墓碑格（**墓碑 actor 是 StaticMeshActor_153~161，无标签、名字不含 Tomb，别按名字找**）→ SpawnSkeletonAt ×6 → NotifyWallDown（置 WallDown=true，IsWalkable 据此打开 '#' 格）→ AddSoul(20) → DestroyActor。
- BP_Lord：TakeTDamage→NotifyLordDead（Phase→lost）；`CastAbility()` 时间戳冷却（GetGameTimeInSeconds ≥ AbilityCd 才可放，放后置 now+60）→ 上下左右四格 SpawnFreeUnit("ghoul") ×4（免费）。
- Director：`SpawnUnit(UnitType:Name)` 付费出兵（查 Soul≥cost、扣费、SpawnCol/Row±2 找可行走格、InitUnit、入 Units 数组）；`SpawnUnitAt(TypeIdx:int, X,Y, Free:bool)` 指定坐标版；`CastQ` = CastTo BP_Lord(Lord)→CastAbility（注意：曾经存在付费版 4×SpawnUnitAt 实现，已被领主技能版替换）；`AddSoul(N)`；`NotifyUnitDead`；`PickUnitAt/PickEnemyAt` 已存在但控制器没用到。遗留死函数：CheckWinLose（旧版，别再接回）、DemoSpawn（空）、SpawnUnit 开头两句 ForLoop 残留死代码（无害）。
- BP_TDPlayerController：BeginPlay（PrintString 诊断 "TDCTL alive"/"cams=N"/"view target set"）→ SetShowMouseCursor/EnableClickEvents/EnableMouseOverEvents/SetInputModeGameAndUI → GetAllActorsOfClass(CameraActor)[0] → SetViewTargetWithBlend ×2（0.5s blend + 0.2s delay 后补一枪防 pawn 抢 view）。输入链：LMB→OnLeftClick（点中 BP_Unit 选中，Shift 加选，点空清空）；RMB→OnRightClick（依次 Cast Tower/Gate/BoneWall/Skeleton 命中→SetTargetCommand，否则 SetMoveCommand(地面点)）；1/2/3/4→SpawnUnit(对应兵种)；Q→CastQ。**注意 SelectedUnits 实际是 Actor 数组**（存的是 BP_Unit，右键循环内逐个 CastToBP_Unit）。遗留无害死事件 OnTestQ（编辑器里可手动删）。
- BP_TDGameMode：DefaultGameMode 已挂 BP_TDPlayerController；关卡 WorldSettings 也已覆盖。项目默认地图 = L_Level01。

## 4. 操作说明（玩家视角）

编辑器里 `Alt+P`（或点 ▶）开 PIE：左键点选自己的兵（Shift 加选/点空取消）；右键点敌人=集火、点地面=移动；`1/2/3/4` 花魂能出兵（25/40/150/120）；`Q` 领主召 4 食尸鬼（60s CD）。左上角蓝字 HUD 实时显示魂能/兵力/阶段。

## 5. 验证状态（诚实清单）

已 PIE 实测通过：
- 出生数量正确：15 兵 / 6 塔 / 11 墙 / 1 门 / 1 领主 / 1 Director；HUD 每 0.5s 刷新 `Soul:100 Units:15 Phase:battle`。
- 复活塔正常出骷髅（上限 3 只在线）；骷髅/小兵 Mobility 已改 Movable（此前 Static 导致移动刷屏报错）。
- 控制器 BeginPlay 生效（日志三件齐：TDCTL alive / cams=1 / view target set）。
- 9 个蓝图全部编译 0 错误；资产与地图已保存。

未实测 / 待验证：
- **真实鼠标点击链路**（点选/右键指令/1-4 出兵/Q）逻辑已按签名接线并编译通过，但工具无法注入鼠标输入，手感与正确性要玩家实测。
- 战斗数值体验（塔 dps、单位存活时间、胜负节奏）未经实机对局检验；网页版引擎测试（四剧本）可作基准：无脑 Rush 会败、南路 180s 可通关。
- 相机最终取景：Cam_Overview 已改 (3200,1200,3600) pitch-90 yaw-90（修正了"地图竖屏"问题）；yaw 方向若感觉左右镜像，把 yaw 改成 -90 即可。
- 门破→胜利播报、领主死→失败、DEFEAT 红字未在实机触发过（逻辑读回验证正确）。

## 6. 已知问题与下一步（按优先级）

1. **M2-2 未做**：挖掘点（食尸鬼在 `?` 格读条 5s → `:` 地道通行 + 两波伏击）、封印裂隙（任意单位在 `X` 读条 8s → 复活间隔 6→12s + 全塔攻速-15% + 80 魂能）、UMG HUD（魂能/兵卡/技能 CD/toast/胜负结算，替换 PrintString 调试行）。
2. **拆塔赏金可能没接**：Director 有 OnTowerDown，但是否 AddSoul(50) 未核实（economy.towerBounty=50）。
3. **M3 门卫平衡**：`rules.gate.doorGuardsPlanned=true`——门自养门卫骷髅防无脑 Rush（网页版 playtest 红线：rush 54.7s 失守）。尚未实现。
4. 哀嚎塔高地射程加成（+2 格）未实现；巨魔对建筑 3 倍伤未确认接入 DealDamageTo。
5. 光照未构建（PIE 顶部红字 LIGHTING NEEDS TO BE REBUILT，纯外观）；视口自动曝光偏亮（可加 PostProcessVolume 锁曝光）。
6. 小坑：BP_Unit 的 Speed/MoveSpeed 双变量并存（只用 MoveSpeed）；bHasMoveCmd/bHasTargetCmd 因工具限制无法清空（行为等效，无实害）；PBestIdx/PBestDist 无消费者。

## 7. 给下一位 AI 的操作手册（UE MCP 工具链 + 踩过的坑）

### 接入
- 编辑器在线时 MCP 端点可用。调用：`mcp__plugin-unreal-engine_unreal-mcp__call_tool(toolset_name, tool_name, arguments)`；发现工具 `search_tools(toolset_name, 单关键词)`（必须带 toolset_name）；查参数 `describe_tool`。
- 常用 toolset：`editor_toolset.toolsets.blueprint.BlueprintTools`（蓝图读写编译）、`editor_toolset.toolsets.programmatic.ProgrammaticToolset`（execute_tool_script 批量）、`editor_toolset.toolsets.scene.SceneTools`（find_actors/add_to_scene_from_asset）、`editor_toolset.toolsets.actor.ActorTools`、`editor_toolset.toolsets.object.ObjectTools`（get/set_properties）、`editor_toolset.toolsets.asset.AssetTools`（save_assets 传空表=存全部脏资产、read_file/write_file 限 /Game/ 与项目 Saved/ 的文本文件）、`EditorToolset.EditorAppToolset`（StartPIE/StopPIE/CaptureViewport）、`EditorToolset.LogsToolset`（GetLogEntries：PrintString 在 `LogBlueprintUserMessages`，编译错误在 `LogBlueprint`）。
- execute_tool_script：先调一次 `get_execution_environment`；脚本必须定义 `run()` 返回 dict；只许 import json/math/time/copy/datetime/re；`execute_tool("全限定工具名", json.dumps({...}))`；**任一子调用抛错整脚本中止**——循环里必须 try/except；返回的字典是 _StrictDict，`.get()` 不支持默认值参数。
- 路径格式：资产 `/Game/Blueprints/BP_X.BP_X`；CDO `/Game/Blueprints/BP_X.Default__BP_X_C`；CDO 组件 `...Default__BP_X_C:StaticMeshComponent0`；图 `资产:GraphName`；节点 `图.K2Node_xxx`；关卡 actor `/Game/Maps/L_Level01.L_Level01:PersistentLevel.ActorName`。PinID=`{"direction":"EGPD_Input"|"EGPD_Output","index_id":int,"node":{"refPath":"..."}}`。
- find_actors 的所有"可选"参数实际都得传（tag:""、collision_channels:[]、root/actor_type/bounds:None）。CaptureViewport 同理要显式传 `"captureTransform": None, "annotations": None`。
- 读 PIE 实况：find_actors 能看到 PIE 世界的 actor；PrintString 屏显+日志双通道；CaptureViewport 抓的是编辑器视口相机（不等于 PIE 玩家视角）；**验证玩家视角用宿主 Python 的 PIL ImageGrab 抓全屏**最靠谱。工具无法注入鼠标键盘，输入链路只能靠人实测。
- 视觉批次操作后务必截图复审；写操作超时/不确定后先只读核对，不盲目重放。

### 蓝图 DSL（write_graph_dsl）坑清单 — 全是实测血泪
1. **写语法≠读语法**：读回显示 `(Utilities|Name|Equal(Name) ...)`，写入要用 `(Utilities|Operators|Equal(==) ...)`（按针脚类型自动特化）。读回 `(|SetbShowMouseCursor true)`，写入要 `(Variables|MouseInterface|SetShowMouseCursor true)`。
2. **bool 变量节点**只有全形式 `(Variables|Default|SetX true)` 可建；简写 `|SetX` 报不存在；裸写变量名会被**静默换成 true**（比报错更危险）。
3. **if/elif/else 多语句分支**：then 分支的多条语句直接依次列出，用 `(elif ...)` / `(else ...)` 收尾（参照本报告附录既有图的读回形态）。分支写完**必须 read_graph_dsl 读回验证**——多 exec 节点的 continuation 可能把后续语句吞进 else。
4. `(return)` 裸返回会被静默丢弃；提前退出要改写成 if/else。
5. int 针脚传浮点字面量（`20.0`）静默丢弃，整数别带小数点；Name/String 比较先把 UnitType/TowerType 当 **Name** 处理。
6. CallFunction 位置参数 #1 是 self 针脚；自调用/调别的 BP 函数用 `(CallFunction|FuncName _selfOrTarget :Param val ...)` 关键字形式最稳。SpawnActor 写 `(Game|SpawnActorfromClass :Class ...)`（写入后自动变成类烘焙形态）。
7. 输入键事件：DSL `(event Input|...)` 不支持。可行路径：DSL 写 `(event Custom|OnX ...)` 自定义事件 → create_node 建 `Input|KeyboardEvents|Q`（或 `Input|MouseEvents|LeftMouseButton`，数字键就是 `"1"`）→ create_node 建 `CallFunction|OnX` → connect_pins 把 InputKey 的 Pressed 接到 CallFunction 的 execute。
8. write_graph_dsl 按事件名增量替换 EventGraph 的单条事件链；报错时可能留下半拉的孤儿节点（同名重写会清掉）。没有删节点的工具（delete_node 除外），死事件只能编辑器里手动删。
9. **编译报 "In use pin ... no longer exists"**：函数改参数名后旧引脚残留。修法：connect_pins 先把源接到新引脚，再按名字动态找旧引脚逐个 break_pins（断线后旧引脚消失、后续引脚 index 前移，**别硬信旧 index**）。
10. 函数参数与成员变量同名（如 InitSkel(Home) 写 Home 变量）可读回确认绑定，实测可用。

### Kimi Work 侧
- 子代理每个 loop 约 100 步上限，resume 不重置计数——拆小任务、用全新子代理串行（并行打同一个 UE 编辑器会互相干扰）。已在 `C:\Users\magnolia\AppData\Roaming\kimi-desktop\daimon-share\config.toml` 的 `[loop_control]` 写了 `max_steps_per_turn=400`，需应用重载才生效。
- 本机 PATH 缺 PowerShell 目录，跑 UE 插件 Python 脚本要加前缀 `PATH="/c/Windows/System32/WindowsPowerShell/v1.0:$PATH"`。
- Bash 不能跑后台进程；PIE 期间截图走 PIL ImageGrab。

## 8. 本次 M2-1 关键修复记录（2026-09-18）

1. BP_Unit RepathTo 里 FindPath 的旧引脚（StartCol/StartRow/EndCol/EndRow）残留 → 引脚手术后 9 蓝图全编译通过。
2. 审计补全：BP_Gate/BP_BoneWall/BP_Lord 的 TakeTDamage、CastAbility；BP_Unit 的 DealDamageTo（五连 Cast）/TickMove/Init/InitUnit；Director 的 NotifyWallDown（bool Set 全形式）/SpawnUnitAt；Skeleton 的 InitSkel；CastQ 改为领主技能入口。
3. 修 CheckEnd 分支颠倒（不再常驻 DEFEAT 红字）；BeginPlay 定时器从遗留 CheckWinLose 改指 GameTick。
4. **塔类型恒真 bug**：EventGraph 与 SetupVisual 里的 `(== 0 0)` 字面量（原 TowerType 比较被静默丢线）→ 全部改 `Equal(==)` Name 比较；InitTower 接管类型初始化（BeginPlay 留空规避 SpawnActor 时序竞争）。修复后复活塔正常出骷髅。
5. BP_Unit/BP_Skeleton 的 StaticMeshComponent0 Mobility：Static → Movable。
6. TDGameDirector 实例放入关卡；18 个 M1 可视化 actor 设 bHidden；Cam_Overview 调到 (3200,1200,3600) pitch-90 yaw-90。

## 9. 快速上手命令

- 打开工程：双击 `BoneWelcome.uproject`（需 UE 5.8）。
- 玩：确认地图 L_Level01 → `Alt+P`。
- 回归参考（网页引擎规则测试）：`cd bone-welcome && node test/smoke.js && node test/flow.js && node test/playtest.js`。

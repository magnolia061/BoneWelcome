// =============================================================
// 白骨迎宾道 · test/flow.js —— node 无头全流程自检（补充 smoke.js）
// 覆盖 smoke 没走的分支：挖掘+伏击两波 / 封印裂隙 / 撞墙惊动 /
// 恐惧脉冲 / 复活塔补骷髅 / 封印后复活间隔翻倍 / 破门胜利。
// 注：读条规则是"受伤即打断"，所以挖掘/封印阶段用测试注入
// 清掉游荡骷髅（模拟队友护航），保证读条不被干扰。
// 运行：node test/flow.js
// =============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..');
const ctx = vm.createContext({});
for (const f of ['js/config.js', 'js/engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(rootDir, f), 'utf8'), ctx, { filename: f });
}
const GAME = ctx.GAME;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('  ✗ ' + msg); }
  else console.log('  ✓ ' + msg);
}

const game = GAME.Engine.createGame();
const S = game.state;
S.soul = 100000; // 测试注入

const log = {};
const ambushEvents = []; // 记录伏击事件坐标，验证刷在离出口最近的墓碑
function drain() {
  for (const e of game.events.splice(0)) {
    log[e.type] = (log[e.type] || 0) + 1;
    if (e.type === 'ambush') ambushEvents.push(e);
  }
}
function run(seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) { game.update(1 / 60); drain(); }
}
// 清场骷髅（测试注入，模拟队友护航）
function clearSkels() {
  for (const s of S.skeletons) if (s.state !== 'dead') { s.hp = 0; s.state = 'dead'; s._deadT = 0; }
}
function runClean(seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) { game.update(1 / 60); drain(); clearSkels(); }
}

console.log('—— 复活塔自动补骷髅 ——');
run(6.5); // 复活塔首轮节拍 6s
assert((log['skeleton-rise'] || 0) >= 3, '6s 后复活塔补出 3 只骷髅（rise ×' + (log['skeleton-rise'] || 0) + '）');
assert(S.tutorialSeen['tut-aoe'] === true, '首次复活触发 tut-aoe');

console.log('—— 密道挖掘 + 伏击两波 ——');
game.spawnUnit('ghoul'); game.spawnUnit('ghoul');
const ghouls = S.units.filter(u => u.type === 'ghoul' && u.state !== 'dead').slice(-2);
// 传送到挖掘点旁 1.5 格内（寻路本身已在 smoke 验证）
ghouls[0].x = 33.5; ghouls[0].y = 18.5;
ghouls[1].x = 34.5; ghouls[1].y = 19.5;
const rDig = game.cmdDig(ghouls.map(u => u.id));
assert(rDig.ok, 'cmdDig 食尸鬼 ok');
runClean(1.2);
assert(log['dig-start'] === 1, 'dig-start 事件发了一次（多人读条不重复发）');
assert(S.dig.progress > 0 && S.dig.progress < 1, '挖掘进度在推进: ' + S.dig.progress.toFixed(2));
const risePreAmbush = log['skeleton-rise'] || 0;
runClean(5);
assert(S.dig.opened === true, '5 秒读条后密道挖开');
assert(log['dig-done'] === 1, 'dig-done 事件');
assert(log['ambush'] === 1, '挖开瞬间第 1 波伏击');
// 伏击应刷在离出口(14,41)最近的墓碑 (16,39)
assert(ambushEvents.length === 1 && ambushEvents[0].wave === 1 &&
  Math.hypot(ambushEvents[0].x - 39.5, ambushEvents[0].y - 16.5) < 0.01,
  '第 1 波刷在离出口最近的墓碑 (16,39)');
assert(game.isWalkable(41, 18) === true, '密道格挖开后可通行');
runClean(6.5);
assert(log['ambush'] === 2 && ambushEvents[1].wave === 2, '6 秒后第 2 波伏击');

console.log('—— 封印裂隙 ——');
const apostle = S.units.find(u => u.type === 'apostle' && u.state !== 'dead');
apostle.x = 38.5; apostle.y = 21.5; // 站上 X 格（使徒免疫毒沼）
const rSeal = game.cmdSeal([apostle.id]);
assert(rSeal.ok, 'cmdSeal ok');
runClean(1);
assert(log['seal-start'] === 1, 'seal-start 事件');
const reviveTower = S.towers.find(t => t.key === 'r');
const soulPreSeal = S.soul;
// 逐帧推进直到封印完成，记录封印发生的精确时刻
let tSeal = 0;
for (let i = 0; i < 60 * 12 && !S.rift.sealed; i++) { game.update(1 / 60); drain(); clearSkels(); }
tSeal = S.time;
assert(S.rift.sealed === true, '8 秒读条后裂隙封印');
assert(log['seal-done'] === 1, 'seal-done 事件');
assert(S.soul === soulPreSeal + GAME.CONFIG.ECONOMY.sealBonus, '封印 +80 魂能');

console.log('—— 封印后复活间隔翻倍 ——');
clearSkels();
let refilledAt = 0;
for (let i = 0; i < 60 * 20; i++) {
  game.update(1 / 60);
  drain();
  // 只留复活塔射程内的骷髅用于观测，刷出即记录
  const cnt = S.skeletons.filter(s => s.state !== 'dead' && Math.hypot(s.x - reviveTower.x, s.y - reviveTower.y) <= reviveTower.range).length;
  if (cnt >= 3) { refilledAt = S.time; break; }
}
assert(refilledAt > 0 && (refilledAt - tSeal) >= 11.5, '封印后复活间隔翻倍为 12s（实际 ' + (refilledAt - tSeal).toFixed(1) + 's）');

console.log('—— 撞墙惊动 + 巨魔 3 倍拆墙 ——');
const troll = S.units.find(u => u.type === 'troll' && u.state !== 'dead');
troll.x = 31.5; troll.y = 10.5; // 贴脸骨墙西侧
const risePreWall = log['skeleton-rise'] || 0;
const rWall = game.cmdAttack([troll.id], 'wall');
assert(rWall.ok, 'cmdAttack 骨墙 ok');
assert(S.tutorialSeen['tut-wall'] === true, '对骨墙下攻击令触发 tut-wall');
run(8);
assert(S.wall.alive === false, '巨魔拆墙（30×3=90/1.2s，400 血 ≈ 6s）');
assert(log['wall-break'] === 1, 'wall-break 事件');
assert(game.isWalkable(32, 10) === true, '墙破后该格可通行');
assert((log['skeleton-rise'] || 0) >= risePreWall + GAME.CONFIG.WALL.ambushCount, '撞破立即惊动 6 只骷髅');

console.log('—— 哀嚎尖塔恐惧脉冲 ——');
const gh2 = S.units.find(u => u.type === 'ghoul' && u.state !== 'dead' && u.state !== 'channel');
gh2.x = 24.5; gh2.y = 6.5; // 走进尖塔射程 8 内
run(4.5);
assert((log['fear'] || 0) >= 1, '恐惧脉冲已发（fear ×' + (log['fear'] || 0) + '）');

console.log('—— 破门胜利 ——');
S.gate.hp = 30; // 测试注入：门打到残血
troll.x = 58.5; troll.y = 10.5; // 贴脸门
game.cmdAttack([troll.id], 'gate');
run(3);
assert(S.gate.alive === false, '门被摧毁');
assert(log['gate-down'] === 1, 'gate-down 事件');
assert(S.phase === 'won', 'phase = won');
assert(log['win'] === 1, 'win 事件');
const projCount = S.projectiles.length;
game.update(1 / 60);
assert(S.phase === 'won' && S.projectiles.length === projCount, 'won 后 update 冻结');

console.log('—— 骷髅守卫 AI：领主在守卫半径内也绝不挨打（新规则断言） ——');
{
  // 独立新局：把领主单独放进复活塔守卫半径 10 秒
  const g2 = GAME.Engine.createGame();
  const S2 = g2.state;
  for (let i = 0; i < 60 * 7; i++) { g2.update(1 / 60); g2.events.length = 0; } // 等复活塔刷出 3 只子代
  const rT2 = S2.towers.find(t => t.key === 'r');
  const guards = S2.skeletons.filter(s => s.state !== 'dead');
  assert(guards.length >= 3, '复活塔已刷出 ' + guards.length + ' 只守卫');
  S2.lord.x = rT2.x; S2.lord.y = rT2.y + 3; // 距家锚点 3 格 < guardRadius 5
  const hp0 = S2.lord.hp;
  let minDist = Infinity, lordHit = false;
  for (let i = 0; i < 60 * 10; i++) {
    g2.update(1 / 60);
    for (const e of g2.events.splice(0)) {
      if (e.type === 'hit' && Math.hypot(e.x - S2.lord.x, e.y - S2.lord.y) < 0.6) lordHit = true;
    }
    for (const s of S2.skeletons) {
      if (s.state !== 'dead') minDist = Math.min(minDist, Math.hypot(s.x - S2.lord.x, s.y - S2.lord.y));
    }
  }
  assert(S2.lord.hp === hp0 && !lordHit, '领主满血且 10 秒内无任何以其为目标的 hit（hp ' + S2.lord.hp + '/' + S2.lord.maxHp + '）');
  assert(minDist > GAME.CONFIG.SKELETON.range + 0.1, '10 秒内无骷髅进入对领主的攻击距离（最近 ' + minDist.toFixed(2) + ' 格）');
  // 副带验证：骷髅平时待在各自家锚点附近（不外出游荡）
  let maxHomeDrift = 0;
  for (const s of S2.skeletons) {
    if (s.state !== 'dead') maxHomeDrift = Math.max(maxHomeDrift, Math.hypot(s.x - s._home.x, s.y - s._home.y));
  }
  assert(maxHomeDrift <= GAME.CONFIG.SKELETON.guardRadius, '全场骷髅均守在家锚点守卫半径内（最大离家 ' + maxHomeDrift.toFixed(2) + ' 格）');
  // 顺带验证：骷髅不打领主后，"无存活单位且魂能不足"败北路径仍生效
  for (const u of S2.units) if (u.state !== 'dead') { u.hp = 0; u.state = 'dead'; u._deadT = 0; }
  S2.soul = 0;
  g2.update(1 / 60);
  assert(S2.phase === 'lost', '无存活单位且魂能不足 → phase=lost（领主仍存活 hp ' + S2.lord.hp + '）');
}

console.log(failures === 0 ? '\n全流程自检通过 ✅' : '\n失败 ' + failures + ' 项 ❌');
process.exit(failures === 0 ? 0 : 1);

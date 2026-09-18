// =============================================================
// 白骨迎宾道 · test/smoke.js —— node 无头冒烟
// 用 vm 把 config.js + engine.js 跑在同一全局里（IIFE 挂 globalThis），
// 覆盖：建局 / 出兵 / 领主技能 / 寻路 / 全军拆箭塔（事件+赏金）/
//       cmdDig 权限 / 败北路径。
// 运行：node test/smoke.js
// =============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..');
const ctx = vm.createContext({}); // IIFE 里 typeof window === 'undefined' → 挂到该 context 的 globalThis
for (const f of ['js/config.js', 'js/engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(rootDir, f), 'utf8'), ctx, { filename: f });
}
const GAME = ctx.GAME;
const CONFIG = GAME.CONFIG;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('  ✗ ' + msg); }
  else console.log('  ✓ ' + msg);
}

console.log('—— 建局与初始状态 ——');
const game = GAME.Engine.createGame();
const S = game.state;
assert(S.phase === 'battle', '初始 phase = battle');
assert(S.soul === CONFIG.ECONOMY.start, '初始魂能 = ' + CONFIG.ECONOMY.start);
assert(S.units.length === 15, '初始兵力 15 个（实际 ' + S.units.length + '）');
assert(S.lord.x === 1.5 && S.lord.y === 10.5, '领主站 S 格 (1.5, 10.5)');
assert(S.towers.length === 6, '塔共 6 座（实际 ' + S.towers.length + '）');
assert(S.wall.tiles.length === 11 && S.wall.alive, '骨墙 11 格且存活');
assert(S.gate.tiles.length === 4 && S.gate.alive, '亡者之门 4 格且存活');
assert(S.tombPoints.length === 9, '墓碑 9 个（实际 ' + S.tombPoints.length + '）');
assert(S.rift.x === 38.5 && S.rift.y === 21.5, '裂隙坐标 (38.5, 21.5)');
assert(S.dig.x === 34.5 && S.dig.y === 18.5, '挖掘点坐标 (34.5, 18.5)');

console.log('—— 地形与寻路 ——');
assert(game.isWalkable(32, 10) === false, '骨墙格破前不可通行');
assert(game.isWalkable(41, 18) === false, '密道格挖开前不可通行');
assert(game.isWalkable(34, 18) === true, '? 挖掘点格可通行');
assert(game.isWalkable(38, 21) === true, 'X 裂隙格可通行');
assert(game.isWalkable(59, 10) === false, 'D 门格不可通行');
assert(game.tileChar(24, 4) === 'w', 'tileChar(24,4) = w');
const p = game.findPath(1.5, 10.5, 41.5, 12.5);
assert(p.length > 0, 'S → 复活塔寻路非空（绕墙），长度 ' + p.length);
const t1 = game.towerAt(9, 6);
assert(t1 && t1.key === 'a', 'towerAt(9,6) 命中骨刺箭塔');

console.log('—— cmdDig 权限 ——');
const archer = S.units.find(u => u.type === 'archer');
const rDig = game.cmdDig([archer.id]);
assert(rDig.ok === false, 'cmdDig 对非食尸鬼返回 ok:false');
assert(game.events.some(e => e.type === 'cmd-denied'), '失败指令发 cmd-denied 事件');
game.events.length = 0; // 清空初始 unit-spawn / cmd-denied 事件

console.log('—— 出兵与领主技能 ——');
S.soul = 10000; // 测试注入魂能
const before = S.units.length;
for (const t of ['ghoul', 'archer', 'troll', 'apostle']) {
  const r = game.spawnUnit(t);
  assert(r.ok, 'spawnUnit(' + t + ') ok');
}
assert(S.units.length === before + 4, '四兵种各出一个，单位 +4');
const rLord = game.castLord();
assert(rLord.ok && S.lord.abilityCd > 0, '尸潮释放成功并进入冷却');
assert(game.castLord().ok === false, '冷却中尸潮返回 ok:false');
assert(game.events.some(e => e.type === 'lord-ability'), 'lord-ability 事件已发');

console.log('—— 全军攻击最近箭塔 ——');
const ids = S.units.filter(u => u.state !== 'dead').map(u => u.id);
let near = null, nd = Infinity;
for (const t of S.towers) {
  const d = Math.hypot(t.x - 1.5, t.y - 10.5);
  if (d < nd) { nd = d; near = t; }
}
assert(near.key === 'a', '离 S 最近的塔是骨刺箭塔 ' + near.id);
const rAtk = game.cmdAttack(ids, near.id);
assert(rAtk.ok, 'cmdAttack 全军 → ' + near.id + ' ok');

const soulBefore = S.soul;
let towerDown = null, soulAtDown = 0;
let steps = 0;
const maxSteps = 60 * 180; // 模拟上限 3 分钟
while (steps++ < maxSteps) {
  game.update(1 / 60);
  const evs = game.events.splice(0);
  for (const e of evs) {
    if (e.type === 'tower-down' && !towerDown) { towerDown = e; soulAtDown = S.soul; }
  }
  if (towerDown) break;
}
assert(!!towerDown, '收到 tower-down 事件（模拟用时 ' + (steps / 60).toFixed(1) + ' 秒）');
assert(towerDown && towerDown.tower.id === near.id, '摧毁的正是目标箭塔');
assert(soulAtDown === soulBefore + CONFIG.ECONOMY.towerBounty,
  '拆塔魂能 +' + CONFIG.ECONOMY.towerBounty + '（' + soulBefore + ' → ' + soulAtDown + '）');
assert(near.alive === false && near.hp === 0, '塔状态 alive=false, hp=0');

console.log('—— 败北路径 ——');
S.lord.hp = 0;
game.update(1 / 60);
assert(S.phase === 'lost', '领主 hp<=0 → phase=lost');
assert(game.events.splice(0).some(e => e.type === 'lose'), 'lose 事件已发');
const rAfter = game.spawnUnit('ghoul');
assert(rAfter.ok === false, 'phase 非 battle 后指令被拒绝');

console.log(failures === 0 ? '\n冒烟通过 ✅' : '\n冒烟失败 ' + failures + ' 项 ❌');
process.exit(failures === 0 ? 0 : 1);

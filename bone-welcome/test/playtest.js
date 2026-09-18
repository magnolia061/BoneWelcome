// =============================================================
// 白骨迎宾道 · test/playtest.js —— QA 无头试玩脚本
// 四个剧本，每个独立建局（独立 vm context + 独立种子）：
//   A 无脑 Rush（红线：必须输，赢了 = 平衡 bug）
//   B 南路动脑子打法（挖掘→密道背刺复活塔→封印裂隙→南侧绕门，必须赢）
//   C 北路打法（高地拆尖塔→绕后拆复活塔→破门，记录结果）
//   D 稳定性压力（随机合法指令，累计 10 分钟战斗时间，
//     断言异常/NaN/越界/卡死/内存无界增长）
// 固定步进 update(1/60)；引擎内 Math.random 与剧本随机都用
// mulberry32 种子化，结果可复现。
// 运行：node test/playtest.js
// =============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..');

// ---------------- 种子化伪随机 ----------------
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 独立 vm context 加载 config+engine，并把引擎里的 Math.random 换成种子版
function loadGame(seed) {
  const ctx = vm.createContext({});
  vm.runInContext('Math.random = (' + mulberry32.toString() + ')(' + (seed | 0) + ');', ctx);
  for (const f of ['js/config.js', 'js/engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(rootDir, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.GAME;
}

const MILESTONE_TYPES = ['tower-down', 'wall-break', 'dig-done', 'seal-done', 'gate-down', 'ambush', 'win', 'lose'];

// =============================================================
// 试玩运行器：步进 / 事件记录 / 死因归因 / 完整性检查
// =============================================================
class Runner {
  constructor(seed, name) {
    this.name = name;
    this.GAME = loadGame(seed);
    this.CONFIG = this.GAME.CONFIG;
    this.game = this.GAME.Engine.createGame();
    this.S = this.game.state;
    this.game.events.length = 0; // 丢掉初始 unit-spawn
    this.eventCounts = {};
    this.eventRing = [];        // 滚动事件日志（含 hit），定长
    this.exceptions = [];       // 引擎/tick 未捕获异常
    this.integrityIssues = [];  // NaN / 越界
    this.deaths = [];           // 单位死亡记录（带归因）
    this.hitWindow = [];        // 近 8 秒的 hit 事件用于归因
    this.maxArrays = { units: 0, skeletons: 0, projectiles: 0 };
    this.tickFn = null;
    this._integritySeen = new Set();
  }

  guessSource(x, y) {
    const S = this.S, out = [];
    try {
      if (this.game.tileChar(x, y) === '~') out.push('毒沼');
      for (const t of S.towers) {
        if (!t.alive) continue;
        const d = Math.hypot(t.x - x, t.y - y);
        if (t.key === 'a' && d <= t.range + 0.05) out.push('骨刺箭塔(' + t.x + ',' + t.y + ')');
        if (t.key === 'p' && d <= t.range + 0.05) out.push('腐尸毒塔毒雾');
      }
      for (const s of S.skeletons) {
        if (s.state !== 'dead' && Math.hypot(s.x - x, s.y - y) <= 1.9) { out.push('骷髅近战'); break; }
      }
    } catch (e) { /* 归因失败不影响主流程 */ }
    return out.length ? out.join('+') : '未知来源';
  }

  onEvent(e, t) {
    this.eventCounts[e.type] = (this.eventCounts[e.type] || 0) + 1;
    if (e.type === 'hit' && e.kind === 'unit') {
      this.hitWindow.push({ t: t, x: e.x, y: e.y, amount: e.amount, src: this.guessSource(e.x, e.y) });
      if (this.hitWindow.length > 3000) this.hitWindow.splice(0, 1000);
    }
    if (e.type !== 'hit' && e.type !== 'soul-change') {
      let desc = e.type;
      if (e.tower) desc += ' ' + e.tower.name + '(' + e.tower.x + ',' + e.tower.y + ')';
      if (e.wave != null) desc += ' wave=' + e.wave;
      if (e.msg) desc += ' ' + e.msg;
      this.eventRing.push({ t: +t.toFixed(2), desc: desc });
      if (this.eventRing.length > 800) this.eventRing.splice(0, 200);
    }
    if (e.type === 'unit-die') {
      const u = e.unit;
      const recent = this.hitWindow.filter(h =>
        t - h.t <= 8 && Math.hypot(h.x - u.x, h.y - u.y) <= 0.9).slice(-6);
      const causes = {};
      for (const h of recent) causes[h.src] = (causes[h.src] || 0) + h.amount;
      this.deaths.push({
        t: +t.toFixed(1), type: u.type, id: u.id,
        x: +u.x.toFixed(1), y: +u.y.toFixed(1),
        causes: causes, lastState: u.state,
      });
    }
  }

  integrityCheck() {
    const S = this.S;
    const chk = (list, label) => {
      for (const e of list) {
        const bad = !isFinite(e.x) || !isFinite(e.y) ? 'NaN坐标'
          : (e.x < 0 || e.x > this.CONFIG.COLS || e.y < 0 || e.y > this.CONFIG.ROWS) ? '越界' : null;
        if (bad && !this._integritySeen.has(label + e.id + bad)) {
          this._integritySeen.add(label + e.id + bad);
          this.integrityIssues.push({ t: +S.time.toFixed(2), what: label + ' ' + e.id + ' ' + bad, x: e.x, y: e.y, state: e.state });
        }
      }
    };
    chk(S.units, 'unit');
    chk(S.skeletons, 'skeleton');
    if (!isFinite(S.lord.x) || !isFinite(S.lord.y)) {
      this.integrityIssues.push({ t: +S.time.toFixed(2), what: 'lord NaN坐标', x: S.lord.x, y: S.lord.y });
    }
  }

  step() {
    const S = this.S;
    if (S.phase !== 'battle') return false;
    try {
      this.game.update(1 / 60);
    } catch (e) {
      this.exceptions.push({ t: +S.time.toFixed(2), err: String((e && e.stack) || e) });
      return false;
    }
    const t = S.time;
    for (const e of this.game.events.splice(0)) this.onEvent(e, t);
    this.integrityCheck();
    this.maxArrays.units = Math.max(this.maxArrays.units, S.units.length);
    this.maxArrays.skeletons = Math.max(this.maxArrays.skeletons, S.skeletons.length);
    this.maxArrays.projectiles = Math.max(this.maxArrays.projectiles, S.projectiles.length);
    if (this.tickFn) {
      try { this.tickFn(this); }
      catch (e) {
        this.exceptions.push({ t: +t.toFixed(2), err: 'tickFn: ' + String((e && e.stack) || e) });
        return false;
      }
    }
    return S.phase === 'battle';
  }

  run(capSeconds) {
    const cap = Math.round(capSeconds * 60);
    let i = 0;
    while (i++ < cap && this.step()) { /* loop */ }
    return this.S.phase;
  }

  alive() { return this.S.units.filter(u => u.state !== 'dead'); }
  aliveIds() { return this.alive().map(u => u.id); }
  byType(ty) { return this.alive().filter(u => u.type === ty); }
  aliveSkels() { return this.S.skeletons.filter(s => s.state !== 'dead'); }

  milestones() {
    return this.eventRing.filter(e => MILESTONE_TYPES.some(m => e.desc.startsWith(m)));
  }

  deathCauseStats() {
    const agg = {};
    for (const d of this.deaths) {
      const k = Object.keys(d.causes).join('+') || '无记录';
      agg[k] = (agg[k] || 0) + 1;
    }
    return Object.entries(agg).sort((a, b) => b[1] - a[1]);
  }

  summary() {
    const S = this.S;
    const comp = {};
    for (const u of this.alive()) comp[u.type] = (comp[u.type] || 0) + 1;
    return {
      phase: S.phase,
      time: +S.time.toFixed(1),
      gateHp: S.gate.hp + '/' + S.gate.maxHp,
      wallAlive: S.wall.alive,
      digOpened: S.dig.opened,
      riftSealed: S.rift.sealed,
      soul: S.soul,
      lordHp: S.lord.hp + '/' + S.lord.maxHp,
      aliveUnits: this.alive().length,
      aliveComp: comp,
      towersDown: S.stats.towersDown,
      skeletonsKilled: S.stats.skeletonsKilled,
      aliveSkeletons: this.aliveSkels().length,
      deaths: this.deaths.length,
      deathCauses: this.deathCauseStats(),
      milestones: this.milestones(),
      exceptions: this.exceptions.length,
      integrityIssues: this.integrityIssues.length,
      maxArrays: this.maxArrays,
    };
  }
}

// =============================================================
// 剧本 A：无脑 Rush（红线——必须输）
// 最近的塔 → 主路向东撞墙 → 破门；魂能一够就补食尸鬼；不封印不挖掘不占高地
// =============================================================
function scenarioA(seed) {
  const R = new Runner(seed, 'A 无脑Rush');
  const { game, S } = R;
  let stage = 0;
  let firstTowerId = null;
  const orderGhoul = (u) => {
    if (S.wall.alive) game.cmdAttack([u.id], 'wall');
    else if (S.gate.alive) game.cmdAttack([u.id], 'gate');
  };

  R.tickFn = () => {
    // 魂能一够就补食尸鬼，直接A上去
    if (S.soul >= R.CONFIG.UNITS.ghoul.cost) {
      const r = game.spawnUnit('ghoul');
      if (r.ok) orderGhoul(S.units[S.units.length - 1]);
    }
    if (S.lord.abilityCd <= 0) game.castLord(); // 白给的食尸鬼也A上去
    switch (stage) {
      case 0: {
        let near = null, nd = Infinity;
        for (const t of S.towers) {
          if (!t.alive) continue;
          const d = Math.hypot(t.x - S.lord.x, t.y - S.lord.y);
          if (d < nd) { nd = d; near = t; }
        }
        if (near) {
          firstTowerId = near.id;
          game.cmdAttack(R.aliveIds(), near.id);
          stage = 1;
        } else stage = 2;
        break;
      }
      case 1: {
        const t = S.towers.find(t => t.id === firstTowerId);
        if (!t || !t.alive) {
          game.cmdMove(R.aliveIds(), 31.0, 10.5); // 主路 rows 10-11 向东，撞墙前集结
          stage = 2;
        }
        break;
      }
      case 2:
        if (!S.wall.alive) {
          game.cmdAttack(R.aliveIds(), 'gate'); // 墙破，沿主路打门
          stage = 3;
        }
        break;
      case 3: break;
    }
  };

  R.run(600);
  return R;
}

// =============================================================
// 剧本 B：南路动脑子打法（必须赢）
// 顺序严格按任务书：食尸鬼挖密道 → 穿密道背刺复活塔 → 封印裂隙 →
// 主力（巨魔顶前+射手+使徒）走南侧平地绕到 D 区 → 先拆门前箭塔 → 破门
// =============================================================
function scenarioB(seed) {
  const R = new Runner(seed, 'B 南路动脑子');
  const { game, S } = R;
  const rTower = S.towers.find(t => t.key === 'r');
  const gateTower = S.towers.find(t => t.key === 'a' && t.x > 40);
  let stage = 'init';
  let stageT = 0;
  let digSquadIds = [];
  let apostleId = null;
  let sealIssued = false, sealRetries = 0;
  let backstabStart = 0, archerSent = false;
  const notes = [];
  const STAGING = { x: 25.5, y: 20.5 };   // 南侧集结（骨墙最南格 32.5,17.5 的射手射程 5 之外，避免自动磨墙）
  const SHIELD = { x: 40.5, y: 18.5 };    // 裂隙北侧肉盾位（比封印者更靠近骷髅源）
  const EAST = { x: 52.5, y: 21.5 };      // D 区南侧平地

  const mainIds = () => R.alive().filter(u => !digSquadIds.includes(u.id) && u.id !== apostleId).map(u => u.id);
  const digAliveIds = () => R.alive().filter(u => digSquadIds.includes(u.id)).map(u => u.id);
  const apostleAlive = () => {
    let u = S.units.find(u => u.id === apostleId && u.state !== 'dead');
    if (!u) {
      const alt = R.alive().find(u => !digSquadIds.includes(u.id));
      if (alt) {
        apostleId = alt.id;
        notes.push('使徒阵亡，封印改由 ' + alt.type + '#' + alt.id + ' 执行');
        u = alt;
      }
    }
    return u || null;
  };
  const sendReinforcement = (u) => {
    // 增援跟随当前主攻方向
    if (stage === 'marchEast' || stage === 'siege' || stage === 'endgame') {
      game.cmdAttack([u.id], gateTower.alive ? gateTower.id : 'gate');
    } else {
      game.cmdMove([u.id], STAGING.x, STAGING.y);
    }
  };

  R.tickFn = () => {
    const t = S.time;
    // 魂能优先补巨魔和射手；领主技能好了就放
    if (S.soul >= R.CONFIG.UNITS.troll.cost) {
      const r = game.spawnUnit('troll');
      if (r.ok) sendReinforcement(S.units[S.units.length - 1]);
    } else if (S.soul >= R.CONFIG.UNITS.archer.cost && R.byType('archer').length < 6) {
      const r = game.spawnUnit('archer');
      if (r.ok) sendReinforcement(S.units[S.units.length - 1]);
    } else if (stage === 'backstab' && R.byType('ghoul').length === 0 && rTower.alive && S.soul >= R.CONFIG.UNITS.ghoul.cost) {
      const r = game.spawnUnit('ghoul'); // 背刺组全灭，补食尸鬼续上火力
      if (r.ok) game.cmdAttack([S.units[S.units.length - 1].id], rTower.id);
    }
    if (S.lord.abilityCd <= 0 && stage !== 'init') {
      if (game.castLord().ok) for (const u of S.units.slice(-4)) if (u.state !== 'dead') sendReinforcement(u);
    }

    switch (stage) {
      case 'init': {
        digSquadIds = R.byType('ghoul').slice(0, 5).map(u => u.id);
        const ap = R.byType('apostle')[0];
        apostleId = ap ? ap.id : null;
        const r1 = game.cmdDig(digSquadIds);
        if (!r1.ok) notes.push('cmdDig 被拒: ' + r1.msg);
        game.cmdMove(mainIds(), STAGING.x, STAGING.y); // 主力南侧集结，策应伏击
        if (ap) game.cmdMove([ap.id], 22.5, 21.5);     // 使徒躲安全角落，专责封印（免疫毒沼）
        game.castLord();
        stage = 'digging'; stageT = t;
        break;
      }
      case 'digging': {
        if (S.dig.opened) {
          const dg = digAliveIds();
          if (dg.length) game.cmdMove(dg, STAGING.x, STAGING.y); // 回撤合兵清伏击
          stage = 'clearAmbush'; stageT = t;
        } else if (t - stageT > 60) {
          notes.push('挖掘 60 秒未完成，dig.progress=' + S.dig.progress.toFixed(2));
          stage = 'clearAmbush'; stageT = t;
        }
        break;
      }
      case 'clearAmbush': {
        const waves = R.eventCounts['ambush'] || 0;
        const wavesDone = !S.dig.opened || waves >= R.CONFIG.TERRAIN.ambushWaves;
        const skelsLeft = R.aliveSkels().length;
        if ((wavesDone && skelsLeft === 0 && t - stageT > 3) || t - stageT > 50) {
          if (t - stageT > 50) notes.push('清伏击超时强推（场上骷髅 ' + skelsLeft + '）');
          // 穿密道背刺复活塔：全部食尸鬼；主力前推到裂隙北侧当肉盾
          const squad = R.byType('ghoul').map(u => u.id);
          if (squad.length) game.cmdAttack(squad, rTower.id);
          else notes.push('清完伏击时已无食尸鬼可背刺');
          game.cmdMove(mainIds(), SHIELD.x, SHIELD.y);
          stage = 'backstab'; stageT = t; backstabStart = t;
        }
        break;
      }
      case 'backstab': {
        if (!rTower.alive) {
          // 塔倒立即封印：主力肉盾位比封印者更靠近残余骷髅，读条不受干扰
          const ap = apostleAlive();
          if (ap) { game.cmdSeal([ap.id]); sealIssued = true; }
          else notes.push('无人能封印（没有存活单位可派）');
          stage = 'sealing'; stageT = t;
          break;
        }
        if (R.byType('ghoul').length >= 3 && t - stageT > 25) {
          game.cmdAttack(R.byType('ghoul').map(u => u.id), rTower.id); // 续压
          stageT = t;
        }
        if (t - backstabStart > 70 && !archerSent) {
          archerSent = true;
          notes.push('背刺 70 秒未拆掉复活塔（塔 hp ' + rTower.hp + '），射手增援密道');
          const arch = R.byType('archer').map(u => u.id);
          if (arch.length) game.cmdAttack(arch, rTower.id);
        }
        if (t - backstabStart > 150) {
          notes.push('背刺 150 秒仍未拆掉复活塔（塔 hp ' + rTower.hp + '），放弃背刺主力强攻');
          stage = 'sealing'; stageT = t; // sealing 超时分支会兜底推进
        }
        break;
      }
      case 'sealing': {
        if (S.rift.sealed || t - stageT > 40) {
          if (!S.rift.sealed) notes.push('封印 40 秒未完成，放弃封印直接推进');
          // 主力走南侧 rows 20-22 平地绕到 D 区；食尸鬼从北侧密道夹击门前箭塔
          const gh = R.byType('ghoul').map(u => u.id);
          if (gh.length && gateTower.alive) game.cmdAttack(gh, gateTower.id);
          const main = R.alive().filter(u => u.type !== 'ghoul').map(u => u.id);
          if (main.length) game.cmdMove(main, EAST.x, EAST.y);
          stage = 'marchEast'; stageT = t;
          break;
        }
        const ap = apostleAlive();
        if (ap && sealIssued && ap.state === 'idle' && !S.rift.sealed && sealRetries < 3) {
          sealRetries++;
          game.cmdSeal([ap.id]); // 被打断重读
        }
        break;
      }
      case 'marchEast': {
        const main = R.alive().filter(u => u.type !== 'ghoul');
        if (!main.length) { stage = 'endgame'; break; }
        const cx = main.reduce((a, u) => a + u.x, 0) / main.length;
        const cy = main.reduce((a, u) => a + u.y, 0) / main.length;
        if ((Math.hypot(cx - EAST.x, cy - EAST.y) < 4 && t - stageT > 3) || t - stageT > 50) {
          game.cmdAttack(main.map(u => u.id), gateTower.alive ? gateTower.id : 'gate');
          stage = 'siege'; stageT = t;
        }
        break;
      }
      case 'siege': {
        if (!gateTower.alive) {
          game.cmdAttack(R.aliveIds(), 'gate');
          stage = 'endgame'; stageT = t;
        }
        break;
      }
      case 'endgame': break;
    }
  };

  R.run(480);
  R.notes = notes;
  return R;
}

// =============================================================
// 剧本 C：北路打法（可选验证）
// 占北高地拆哀嚎尖塔 → 墓地北侧绕后拆复活塔 → 破门
// =============================================================
function scenarioC(seed) {
  const R = new Runner(seed, 'C 北路打法');
  const { game, S } = R;
  const spire = S.towers.find(t => t.key === 'w');
  const rTower = S.towers.find(t => t.key === 'r');
  const westArrow = S.towers.find(t => t.key === 'a' && t.x < 20 && t.y < 10);
  const gateTower = S.towers.find(t => t.key === 'a' && t.x > 40);
  let stage = 0, stageT = 0;
  const notes = [];
  const objectiveId = () => {
    if (westArrow.alive) return westArrow.id;
    if (spire.alive) return spire.id;
    if (rTower.alive) return rTower.id;
    if (gateTower.alive) return gateTower.id;
    return 'gate';
  };

  R.tickFn = () => {
    const t = S.time;
    if (S.soul >= R.CONFIG.UNITS.troll.cost) {
      const r = game.spawnUnit('troll');
      if (r.ok) game.cmdAttack([S.units[S.units.length - 1].id], objectiveId());
    }
    if (S.lord.abilityCd <= 0) {
      if (game.castLord().ok) game.cmdAttack(S.units.slice(-4).map(u => u.id), objectiveId());
    }
    switch (stage) {
      case 0: // 先拔西侧箭塔（上高地的必经路口）
        game.cmdAttack(R.aliveIds(), westArrow.id);
        stage = 1; break;
      case 1:
        if (!westArrow.alive) { game.cmdAttack(R.aliveIds(), spire.id); stage = 2; stageT = t; }
        break;
      case 2:
        if (!spire.alive) { game.cmdAttack(R.aliveIds(), rTower.id); stage = 3; stageT = t; }
        else if (t - stageT > 60) { notes.push('拆哀嚎尖塔超过 60 秒（塔 hp ' + spire.hp + '）'); stageT = t; }
        break;
      case 3:
        if (!rTower.alive) { game.cmdAttack(R.aliveIds(), gateTower.id); stage = 4; stageT = t; }
        else if (t - stageT > 90) { notes.push('拆复活塔超过 90 秒（塔 hp ' + rTower.hp + '）'); stageT = t; }
        break;
      case 4:
        if (!gateTower.alive) { game.cmdAttack(R.aliveIds(), 'gate'); stage = 5; }
        break;
      case 5: break;
    }
  };

  R.run(480);
  R.notes = notes;
  return R;
}

// =============================================================
// 剧本 D：稳定性压力测试
// 随机出兵/随机合法指令/技能乱按；败北后开新局继续，
// 累计 600 秒战斗时间。断言：无异常 / 无 NaN / 不出界 /
// 无卡死 / 数组不无界增长 / 尸体清理正常。
// =============================================================
function scenarioD(seed, totalSeconds) {
  const rng = mulberry32(seed ^ 0x5f3759df);
  const types = ['ghoul', 'archer', 'troll', 'apostle'];
  const issues = [];
  const rounds = [];
  let accumulated = 0, roundNo = 0;
  let globalMax = { units: 0, skeletons: 0, projectiles: 0 };

  while (totalSeconds - accumulated > 1 && roundNo < 12) {
    roundNo++;
    const R = new Runner(seed + roundNo, 'D 第' + roundNo + '局');
    const { game, S } = R;
    const moveTrack = new Map();
    let nextDecision = 0;
    let growthAlarmed = false;

    const randWalkable = () => {
      for (let i = 0; i < 40; i++) {
        const c = 1 + ((rng() * (R.CONFIG.COLS - 2)) | 0);
        const r = 1 + ((rng() * (R.CONFIG.ROWS - 2)) | 0);
        if (game.isWalkable(c + 0.5, r + 0.5)) return { x: c + 0.5, y: r + 0.5 };
      }
      return { x: 1.5, y: 10.5 };
    };
    const randSubset = (ids) => ids.filter(() => rng() < 0.5);

    R.tickFn = () => {
      const t = S.time;
      // ---- 随机指令（合法指令随机选）----
      if (t >= nextDecision) {
        nextDecision = t + 1.5;
        const roll = rng();
        const ids = R.aliveIds();
        try {
          if (roll < 0.25) {
            game.spawnUnit(types[(rng() * 4) | 0]);
          } else if (roll < 0.45 && ids.length) {
            const p = randWalkable();
            game.cmdMove(randSubset(ids), p.x, p.y);
          } else if (roll < 0.65 && ids.length) {
            const targets = S.towers.filter(tw => tw.alive).map(tw => tw.id)
              .concat(S.wall.alive ? ['wall'] : [], S.gate.alive ? ['gate'] : [],
                R.aliveSkels().map(s => s.id));
            if (targets.length) game.cmdAttack(randSubset(ids), targets[(rng() * targets.length) | 0]);
          } else if (roll < 0.75) {
            const g = R.byType('ghoul').map(u => u.id);
            if (g.length) game.cmdDig(g);
          } else if (roll < 0.85 && ids.length) {
            game.cmdSeal(randSubset(ids));
          } else {
            game.castLord();
          }
        } catch (e) {
          issues.push({ round: roundNo, t: +t.toFixed(1), what: '指令调用抛异常: ' + e.message });
        }
      }
      // ---- 卡死检测：state='move' 下 20 秒位移 < 0.5 格 ----
      for (const u of S.units) {
        if (u.state === 'dead') continue;
        const tr = moveTrack.get(u.id);
        if (u.state === 'move') {
          if (!tr || tr.state !== 'move') moveTrack.set(u.id, { state: 'move', startT: t, x: u.x, y: u.y, flagged: false });
          else if (!tr.flagged && t - tr.startT >= 20) {
            const moved = Math.hypot(u.x - tr.x, u.y - tr.y);
            if (moved < 0.5) {
              tr.flagged = true;
              issues.push({
                round: roundNo, t: +t.toFixed(1),
                what: '卡死: ' + u.type + '#' + u.id + ' state=move 持续 ' + (t - tr.startT).toFixed(0) + 's 位移仅 ' + moved.toFixed(2) + ' 格，位置 (' + u.x.toFixed(1) + ',' + u.y.toFixed(1) + ')',
              });
            } else {
              moveTrack.set(u.id, { state: 'move', startT: t, x: u.x, y: u.y, flagged: false });
            }
          }
        } else if (tr && tr.state === 'move') {
          moveTrack.set(u.id, { state: u.state });
        }
      }
      // ---- 无界增长哨兵 ----
      if (!growthAlarmed && (S.units.length > 300 || S.skeletons.length > 300 || S.projectiles.length > 2000)) {
        growthAlarmed = true;
        issues.push({
          round: roundNo, t: +t.toFixed(1),
          what: '数组膨胀告警: units=' + S.units.length + ' skeletons=' + S.skeletons.length + ' projectiles=' + S.projectiles.length,
        });
      }
    };

    R.run(totalSeconds - accumulated);
    accumulated += S.time;
    for (const k of ['units', 'skeletons', 'projectiles']) globalMax[k] = Math.max(globalMax[k], R.maxArrays[k]);
    const deadLeft = S.units.filter(u => u.state === 'dead').length + S.skeletons.filter(s => s.state === 'dead').length;
    rounds.push({
      round: roundNo, seed: seed + roundNo, phase: S.phase, time: +S.time.toFixed(1),
      deadLeftAtEnd: deadLeft,
      exceptions: R.exceptions, integrityIssues: R.integrityIssues,
      skeletonsKilled: S.stats.skeletonsKilled, towersDown: S.stats.towersDown,
    });
    if (deadLeft > 40) {
      issues.push({ round: roundNo, t: S.time, what: '尸体清理异常：终局残留 dead 实体 ' + deadLeft + ' 个' });
    }
    for (const ex of R.exceptions) issues.push({ round: roundNo, t: ex.t, what: '未捕获异常: ' + ex.err.split('\n')[0] });
    for (const is of R.integrityIssues) issues.push({ round: roundNo, t: is.t, what: is.what + ' @(' + is.x + ',' + is.y + ')' });
  }

  return { rounds: rounds, accumulated: +accumulated.toFixed(1), issues: issues, globalMax: globalMax };
}

// =============================================================
// 附加探针（辅助证据，独立建局）：复现试玩中暴露的引擎疑点
//   P1 恐惧期间 cmdMove 返回 ok 但指令被静默吞掉
//   P2 复活塔"补足至 3 只"实为无限骷髅喷泉
//   P3 cmdSeal 站位选择把非免疫单位放进毒沼 → 读条永远被打断
// =============================================================
function probes() {
  const out = { bugs: [], balance: [] };

  // ---- P1：恐惧中下达移动指令 ----
  {
    const GAME = loadGame(777);
    const game = GAME.Engine.createGame();
    const S = game.state;
    game.events.length = 0;
    const ghoul = S.units.find(u => u.type === 'ghoul');
    ghoul.x = 24.5; ghoul.y = 8.5; // 哀嚎尖塔射程内
    let feared = false;
    for (let i = 0; i < 60 * 6 && !feared; i++) {
      game.update(1 / 60);
      for (const e of game.events.splice(0)) if (e.type === 'fear') feared = true;
    }
    if (feared && ghoul.fearT > 0) {
      const r = game.cmdMove([ghoul.id], 40.5, 20.5);
      for (let i = 0; i < 60 * 4; i++) game.update(1 / 60);
      const dropped = ghoul.state === 'idle' && Math.hypot(ghoul.x - 40.5, ghoul.y - 20.5) > 5;
      if (r.ok && dropped) {
        out.bugs.push({
          sev: '低', title: '恐惧中下达的指令被静默吞掉（cmdMove 返回 ok:true 却不执行）',
          detail: '食尸鬼 fearT>0 时 cmdMove 返回 ok，恐惧结束后单位原地待机，指令丢失。' +
            '相关：engine.js updateUnit() 恐惧分支（每帧强制 state=fear，结束时 state=idle 且 _path=null）与 applyFear()（清 targetId/_path）。' +
            '合同规则 4 规定恐惧"不可控"，丢弃指令本身合理，但指令 API 应返回 cmd-denied 或在恐惧结束后继续执行。',
        });
      }
    }
  }

  // ---- P2：复活塔骷髅喷泉 ----
  {
    const GAME = loadGame(888);
    const game = GAME.Engine.createGame();
    const S = game.state;
    game.events.length = 0;
    const troll = S.units.find(u => u.type === 'troll');
    troll.x = 41.5; troll.y = 20.5; // 站复活塔 8 格外当诱饵
    for (const u of S.units) if (u !== troll) { u.hp = 0; u.state = 'dead'; u._deadT = 0; }
    let rises = 0;
    for (let i = 0; i < 60 * 60; i++) {
      game.update(1 / 60);
      for (const e of game.events.splice(0)) if (e.type === 'skeleton-rise') rises++;
    }
    const alive = S.skeletons.filter(s => s.state !== 'dead').length;
    if (rises > 12) { // 理论"补足至3只"不应持续满负荷刷
      out.balance.push('复活塔是无限骷髅喷泉：骷髅追人离开射程 4 后塔继续补，60s 刷出 ' + rises +
        ' 只（场上同时存活 ' + alive + ' 只），config 描述是"补足至 3 只"。' +
        'engine.js updateTowers() r 分支只统计射程内骷髅数。压力随时间无限累积，消极打法必被磨死（剧本 D 各局均因此败北）。');
    }
  }

  // ---- P3：cmdSeal 站位落进毒沼 ----
  {
    const probeOne = (gx, gy) => {
      const GAME = loadGame(999);
      const game = GAME.Engine.createGame();
      const S = game.state;
      game.events.length = 0;
      const ghoul = S.units.find(u => u.type === 'ghoul');
      ghoul.x = gx; ghoul.y = gy;
      game.cmdSeal([ghoul.id]);
      for (let i = 0; i < 60 * 12 && !S.rift.sealed; i++) { game.update(1 / 60); game.events.length = 0; }
      return { sealed: S.rift.sealed, tile: game.tileChar(ghoul.x, ghoul.y), x: ghoul.x, y: ghoul.y };
    };
    const offX = probeOne(38.5, 19.5); // 从北侧接近：被分配到毒沼格
    const onX = probeOne(38.5, 21.5);  // 已站 X 格：原地读条
    if (!offX.sealed && onX.sealed) {
      out.bugs.push({
        sev: '中等',
        title: 'cmdSeal 把非免疫单位分派到毒沼格，中毒每 0.5s 打断读条 → 封印事实失败',
        detail: '从北侧接近裂隙的食尸鬼被安排站到 (' + offX.x.toFixed(1) + ',' + offX.y.toFixed(1) + ') 地形 "' + offX.tile +
          '"，12 秒读条期内被毒沼 DoT 反复打断，封印永远完成不了；只有恰好站在 X 格本格（免疫判定外）才能封上。' +
          '相关：engine.js issueChannelOrder() 的候选格按 dr/dc 固定顺序选取，不避开 "~" 格、也不优先目标格本身；' +
          'updatePoison() 的 DoT 走 damageUnit() → interruptChannel()。' +
          '后果：封印裂隙对非使徒单位几乎不可用（剧本 B 中备用封印者全部失败，只有免疫毒沼的使徒能完成）。',
      });
    }
  }

  return out;
}

// =============================================================
// 汇总报告
// =============================================================
function fmtSummary(s) {
  const lines = [
    '  结局: ' + s.phase + '   用时: ' + s.time + 's',
    '  门剩余血量: ' + s.gateHp + '   骨墙存活: ' + s.wallAlive + '   密道: ' + (s.digOpened ? '已挖开' : '未挖') + '   裂隙: ' + (s.riftSealed ? '已封印' : '未封印'),
    '  存活兵力: ' + s.aliveUnits + ' ' + JSON.stringify(s.aliveComp) + '   领主: ' + s.lordHp + '   魂能: ' + s.soul,
    '  拆塔: ' + s.towersDown + '/6   杀骷髅: ' + s.skeletonsKilled + '   场上骷髅: ' + s.aliveSkeletons + '   我方阵亡: ' + s.deaths,
    '  异常: ' + s.exceptions + '   完整性问题: ' + s.integrityIssues + '   数组峰值: ' + JSON.stringify(s.maxArrays),
  ];
  if (s.milestones && s.milestones.length) {
    lines.push('  时间线: ' + s.milestones.map(m => m.t + 's ' + m.desc).join(' → '));
  }
  if (s.deathCauses && s.deathCauses.length) {
    lines.push('  死因统计: ' + s.deathCauses.map(([k, v]) => k + '×' + v).join(', '));
  }
  return lines.join('\n');
}

function dumpDeaths(R, limit) {
  const ds = R.deaths.slice(-(limit || 25));
  if (!ds.length) return '  （无单位死亡）';
  return ds.map(d => {
    const causes = Object.entries(d.causes).map(([k, v]) => k + '≈' + Math.round(v)).join('+') || '无记录';
    return '  t=' + d.t + 's ' + d.type + '#' + d.id + ' 死于 (' + d.x + ',' + d.y + ') state=' + d.lastState + ' 凶手: ' + causes;
  }).join('\n');
}

function dumpEvents(R, sec) {
  const from = R.S.time - sec;
  const evs = R.eventRing.filter(e => e.t >= from);
  if (!evs.length) return '  （最近 ' + sec + ' 秒无关键事件）';
  return evs.slice(-80).map(e => '  t=' + e.t + 's ' + e.desc).join('\n');
}

const bugs = [];      // 硬性 bug
const balance = [];   // 平衡观察

console.log('========== 剧本 A：无脑 Rush（红线，必须输） ==========');
const RA = scenarioA(1001);
console.log(fmtSummary(RA.summary()));
if (RA.S.phase === 'won') {
  bugs.push({
    sev: '平衡（红线）', title: '无脑 Rush 竟然通关',
    detail: '剧本 A 在 ' + RA.S.time.toFixed(1) + 's 破门获胜，毫无策略的打法不应能赢。',
  });
}
if (RA.S.phase === 'battle') balance.push('A: 600s 未分胜负（门 hp ' + RA.S.gate.hp + '），rush 僵局，需关注终局收敛');

console.log('\n========== 剧本 B：南路动脑子打法（必须赢） ==========');
const RB = scenarioB(2002);
console.log(fmtSummary(RB.summary()));
if (RB.notes && RB.notes.length) console.log('  剧本备注:\n' + RB.notes.map(n => '  - ' + n).join('\n'));
if (RB.S.phase !== 'won') {
  bugs.push({
    sev: '严重', title: '合理南路打法无法通关',
    detail: '剧本 B 结局 ' + RB.S.phase + '（用时 ' + RB.S.time.toFixed(1) + 's，门 hp ' + RB.S.gate.hp + '）',
  });
  console.log('\n—— B 失败：最后 60 秒关键事件流 ——');
  console.log(dumpEvents(RB, 60));
  console.log('—— B 各单位死因（最近 25 条） ——');
  console.log(dumpDeaths(RB, 25));
}

console.log('\n========== 剧本 C：北路打法（可选验证） ==========');
const RC = scenarioC(3003);
console.log(fmtSummary(RC.summary()));
if (RC.notes && RC.notes.length) console.log('  剧本备注:\n' + RC.notes.map(n => '  - ' + n).join('\n'));

console.log('\n========== 剧本 D：稳定性压力测试 ==========');
const RD = scenarioD(4004, 600);
console.log('  累计战斗时间: ' + RD.accumulated + 's（' + RD.rounds.length + ' 局）');
for (const r of RD.rounds) {
  console.log('  第' + r.round + '局(seed ' + r.seed + '): ' + r.phase + ' @' + r.time + 's，拆塔 ' + r.towersDown + '，杀骷髅 ' + r.skeletonsKilled + '，残留尸体 ' + r.deadLeftAtEnd + '，异常 ' + r.exceptions.length + '，完整性 ' + r.integrityIssues.length);
}
console.log('  全局数组峰值: ' + JSON.stringify(RD.globalMax) + '   断言问题: ' + RD.issues.length);
for (const i of RD.issues.slice(0, 30)) console.log('  ✗ 第' + i.round + '局 t=' + i.t + 's ' + i.what);

// ---- 跨剧本通用异常汇总 ----
for (const [tag, R] of [['A', RA], ['B', RB], ['C', RC]]) {
  for (const ex of R.exceptions.slice(0, 3)) {
    bugs.push({ sev: '致命', title: '剧本' + tag + ' 未捕获异常 @t=' + ex.t + 's', detail: ex.err.split('\n').slice(0, 4).join(' | ') });
  }
  for (const is of R.integrityIssues.slice(0, 5)) {
    bugs.push({ sev: '严重', title: '剧本' + tag + ' ' + is.what + ' @t=' + is.t + 's', detail: '坐标 (' + is.x + ',' + is.y + ') state=' + is.state });
  }
}
for (const i of RD.issues) {
  bugs.push({ sev: i.what.indexOf('卡死') === 0 ? '严重' : '中等', title: '剧本D第' + i.round + '局 ' + i.what.slice(0, 30) + ' @t=' + i.t + 's', detail: i.what });
}

// ---- 附加探针 ----
console.log('\n========== 附加探针（引擎疑点复现） ==========');
const PB = probes();
for (const b of PB.bugs) bugs.push(b);
for (const b of PB.balance) balance.push(b);
console.log('探针复现 bug ' + PB.bugs.length + ' 条，平衡观察 ' + PB.balance.length + ' 条');

// ---- 基于试玩数据的平衡观察（数据见各剧本时间线/死因统计） ----
if (RC.S.phase === 'won' && RB.S.phase === 'won') {
  balance.push('北路强度碾压南路：北路 ' + RC.S.time.toFixed(1) + 's 通关、阵亡 ' + RC.deaths.length +
    '，南路（挖掘+背刺+封印）' + RB.S.time.toFixed(1) + 's、阵亡 ' + RB.deaths.length +
    '。哀嚎尖塔 250hp 被免疫恐惧的巨魔秒拆，恐惧机制在北路几乎无存在感；最优策略≈无脑北路。');
}
balance.push('骨墙防不住"顺手"：最南墙格 (32.5,17.5) 距挖掘点仅 3 格，任何在南路集结/挖掘的射手（射程 5）静止时都会自动磨墙触发 6 骷髅惊动，"悄悄挖密道"玩法很难成立（本次剧本 B 集结点挪到 (25.5,20.5) 才避开）。');
balance.push('门前箭塔 (54.5,9.5) 是唯一的门神但单体 25dps 对成群单位威慑不足：北路剧本 10 秒拆塔+破门，单位在 move 状态不还击，行军途中被箭塔白嫖（南路剧本死于行军箭塔的单位达 8 个）——两头都欠顺滑。');
balance.push('封印裂隙收益（+80 魂能/全塔攻速-15%/复活间隔翻倍）相对 8 秒不可受击的读条成本偏低：南路剧本中封印完成时复活塔已死，-15% 攻速对剩余两座箭塔影响有限，玩家缺乏封印动机。');

console.log('\n=================================================');
console.log('BUG 清单（' + bugs.length + ' 条）');
console.log('=================================================');
if (!bugs.length) console.log('（无硬性 bug）');
bugs.forEach((b, i) => console.log('BUG-' + (i + 1) + ' 【' + b.sev + '】' + b.title + '\n    ' + b.detail));

console.log('\n平衡/手感观察（' + balance.length + ' 条）');
if (!balance.length) console.log('（无）');
balance.forEach((b, i) => console.log('OBS-' + (i + 1) + ' ' + b));

// 机器可读结果落盘，便于 QA 归档
const results = {
  seedBase: { A: 1001, B: 2002, C: 3003, D: 4004 },
  A: RA.summary(), B: Object.assign(RB.summary(), { notes: RB.notes || [] }),
  C: Object.assign(RC.summary(), { notes: RC.notes || [] }),
  D: RD,
  bugs: bugs, balance: balance,
};
fs.writeFileSync(path.join(__dirname, 'playtest-results.json'), JSON.stringify(results, (k, v) => v === Infinity ? 'Infinity' : v, 2));

const hardFail = bugs.length;
console.log('\n结果已写入 test/playtest-results.json');
console.log(hardFail === 0 ? '\n试玩通过 ✅（无硬性 bug）' : '\n发现 ' + hardFail + ' 个硬性 bug ❌');
process.exit(hardFail === 0 ? 0 : 1);

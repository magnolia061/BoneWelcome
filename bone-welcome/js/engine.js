// =============================================================
// 白骨迎宾道 · engine.js —— 玩法引擎
// 合同要求：DOM 安全（node 可无头加载），只读 GAME.CONFIG，
// 对外暴露 GAME.Engine.createGame()；state 形状 / 事件类型 /
// 指令 API 严格遵循 CONTRACT.md，一个字段不少。
// 内部实现细节一律用下划线前缀字段，渲染/UI 同事可忽略。
// =============================================================
(function (root) {
  'use strict';
  root.GAME = root.GAME || {};

  // ---------------- 基础工具 ----------------
  function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  // A* 用最小堆（按 f = g + h 弹出）
  function MinHeap() { this.k = []; this.p = []; }
  MinHeap.prototype.size = function () { return this.k.length; };
  MinHeap.prototype.push = function (key, pri) {
    const k = this.k, p = this.p;
    k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      const tk = k[par]; k[par] = k[i]; k[i] = tk;
      const tp = p[par]; p[par] = p[i]; p[i] = tp;
      i = par;
    }
  };
  MinHeap.prototype.pop = function () {
    const k = this.k, p = this.p, top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        const tk = k[m]; k[m] = k[i]; k[i] = tk;
        const tp = p[m]; p[m] = p[i]; p[i] = tp;
        i = m;
      }
    }
    return top;
  };

  // 完全重叠时给分离抖动一个确定方向
  function hashId(id) {
    const s = String(id);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  // =============================================================
  // 创建一局游戏
  // =============================================================
  function createGame() {
    const CONFIG = root.GAME.CONFIG;
    if (!CONFIG) throw new Error('engine.js: 需要先加载 config.js');
    const COLS = CONFIG.COLS, ROWS = CONFIG.ROWS, MAP = CONFIG.MAP_ROWS;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // config 未给使徒毒云溅射半径：按其射程一半取值（=1.5 格）
    const AOE_RADIUS = (CONFIG.UNITS.apostle.range || 3) * 0.5;
    // 败北阈值：魂能买不起最便宜的兵（当前配置 = 25）
    const MIN_UNIT_COST = Math.min.apply(null, Object.keys(CONFIG.UNITS).map(function (k) { return CONFIG.UNITS[k].cost; }));

    // ---------- 解析地图：塔 / 墙 / 门 / 墓碑 / 密道 / 挖掘点 / 裂隙 / 入口 ----------
    const towers = [];
    const wallTiles = [], gateTiles = [], tombPoints = [], tunnelCells = [];
    let digCell = null, riftCell = null, spawnCell = null, towerSeq = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = MAP[r][c];
        if (CONFIG.TOWERS[ch]) {
          const cfg = CONFIG.TOWERS[ch];
          towers.push({
            id: 't' + (++towerSeq),
            key: ch,
            name: cfg.name,
            x: c + 0.5, y: r + 0.5,
            hp: cfg.hp, maxHp: cfg.hp,
            // 哀嚎尖塔站在 ^ 高地上，射程用 highRange（合同规则 2）
            range: cfg.highRange != null ? cfg.highRange : cfg.range,
            alive: true,
            atkCd: cfg.interval ? ((towerSeq * 0.37) % cfg.interval) : 0, // 错开首轮开火
            _cfg: cfg,
            _kind: 'tower',
            _reviveCd: cfg.interval || 0, // 复活塔专用节拍
            _children: [],                // 复活塔召唤且仍存活的骷髅（合同规则 5 的规模上限）
          });
        } else if (ch === '#') wallTiles.push([r, c]);
        else if (ch === 'D') gateTiles.push([r, c]);
        else if (ch === 'T') tombPoints.push([r, c]);
        else if (ch === ':') tunnelCells.push([r, c]);
        else if (ch === '?') digCell = { r: r, c: c };
        else if (ch === 'X') riftCell = { r: r, c: c };
        else if (ch === 'S') spawnCell = { r: r, c: c };
      }
    }
    function tilesCenter(tiles) {
      let sr = 0, sc = 0;
      for (let i = 0; i < tiles.length; i++) { sr += tiles[i][0]; sc += tiles[i][1]; }
      return { cx: sc / tiles.length + 0.5, cy: sr / tiles.length + 0.5 };
    }
    const wallC = tilesCenter(wallTiles), gateC = tilesCenter(gateTiles);
    // 密道出口 = 最北端的密道格（设计文档：行 14，列 41）
    let exitCell = tunnelCells[0] || [0, 0];
    for (let i = 0; i < tunnelCells.length; i++) if (tunnelCells[i][0] < exitCell[0]) exitCell = tunnelCells[i];
    const exitX = exitCell[1] + 0.5, exitY = exitCell[0] + 0.5;

    // ---------- state（严格按合同形状；下划线字段为引擎内部数据） ----------
    const state = {
      time: 0,
      phase: 'battle',
      soul: CONFIG.ECONOMY.start,
      kills: 0,
      lord: {
        x: spawnCell.c + 0.5, y: spawnCell.r + 0.5,
        hp: CONFIG.LORD.hp, maxHp: CONFIG.LORD.hp,
        abilityCd: 0,
      },
      units: [],
      skeletons: [],
      towers: towers,
      projectiles: [],
      wall: {
        id: 'wall', tiles: wallTiles, cx: wallC.cx, cy: wallC.cy,
        hp: CONFIG.WALL.hp, maxHp: CONFIG.WALL.hp, alive: true,
      },
      gate: {
        id: 'gate', tiles: gateTiles, cx: gateC.cx, cy: gateC.cy,
        hp: CONFIG.GATE.hp, maxHp: CONFIG.GATE.hp, alive: true,
      },
      rift: { id: 'rift', x: riftCell.c + 0.5, y: riftCell.r + 0.5, sealed: false, progress: 0 },
      dig: { id: 'dig', x: digCell.c + 0.5, y: digCell.r + 0.5, opened: false, progress: 0 },
      tombPoints: tombPoints,
      tutorialSeen: {},
      stats: { towersDown: 0, skeletonsKilled: 0, soulEarned: 0 },
    };

    // ---------- 引擎内部运行数据 ----------
    const events = [];
    let pathVersion = 0;              // 骨墙破 / 密道开时 +1，寻路缓存整体失效（合同规则 13）
    let pathCache = new Map();
    let unitSeq = 0, skelSeq = 0, projSeq = 0;
    let towerSpdMult = 1;             // 封印裂隙后全塔攻速 -15%（= 0.85），攻击间隔 = 基础 / 它
    const pendingSpawns = [];         // 密道第二波伏击 [{at, wave}]
    let firstReviveDone = false;      // 复活塔首次复活 → tut-aoe

    function push(e) { events.push(e); }
    function deny(msg) { push({ type: 'cmd-denied', msg: msg }); return { ok: false, msg: msg }; }

    // =============================================================
    // 地形与通行
    // =============================================================
    function charAt(c, r) {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '%';
      return MAP[r][c];
    }
    // 整数格通行判定：% / D 永不可走；# 破前不可走；: 挖开前不可走；其余皆可走
    function walkCell(c, r) {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
      const ch = MAP[r][c];
      if (ch === '%' || ch === 'D') return false;
      if (ch === '#') return !state.wall.alive;
      if (ch === ':') return state.dig.opened;
      return true;
    }
    function isWalkable(cx, cy) { return walkCell(Math.floor(cx), Math.floor(cy)); }
    function tileChar(cx, cy) { return charAt(Math.floor(cx), Math.floor(cy)); }

    // 环形搜索最近的可达格（指令目的地吸附用）
    function nearestWalkable(c, r, maxR) {
      if (walkCell(c, r)) return { c: c, r: r };
      for (let rad = 1; rad <= maxR; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
            if (walkCell(c + dc, r + dr)) return { c: c + dc, r: r + dr };
          }
        }
      }
      return null;
    }

    // =============================================================
    // 寻路：A*，4 向，64×24 小图性能无忧；带版本号缓存
    // =============================================================
    function astarCells(sc, sr, isGoal, heur) {
      if (isGoal(sc, sr)) return [[sc, sr]];
      const g = new Map(), came = new Map(), closed = new Set();
      const heap = new MinHeap();
      const sk = sr * COLS + sc;
      g.set(sk, 0);
      heap.push(sk, heur(sc, sr));
      let guard = 0;
      const maxExpand = COLS * ROWS * 4;
      while (heap.size() > 0) {
        const cur = heap.pop();
        if (closed.has(cur)) continue;
        closed.add(cur);
        const cc = cur % COLS, cr = (cur / COLS) | 0;
        if (cur !== sk && isGoal(cc, cr)) {
          const out = [[cc, cr]];
          let k = cur;
          while (came.has(k)) { k = came.get(k); out.push([k % COLS, (k / COLS) | 0]); }
          out.reverse();
          return out;
        }
        const cg = g.get(cur);
        for (let i = 0; i < 4; i++) {
          const nc = cc + DIRS[i][0], nr = cr + DIRS[i][1];
          if (!walkCell(nc, nr)) continue;
          const nk = nr * COLS + nc;
          const ng = cg + 1;
          if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
            g.set(nk, ng);
            came.set(nk, cur);
            heap.push(nk, ng + heur(nc, nr));
          }
        }
        if (++guard > maxExpand) break;
      }
      return null;
    }

    // 合同查询助手：返回 [{x,y}...] 格中心点序列（含起点与终点）
    function findPath(sx, sy, tx, ty) {
      let sc = Math.floor(sx), sr = Math.floor(sy);
      let tc = Math.floor(tx), tr = Math.floor(ty);
      if (!walkCell(sc, sr)) {
        const n = nearestWalkable(sc, sr, 4);
        if (!n) return [];
        sc = n.c; sr = n.r;
      }
      if (!walkCell(tc, tr)) {
        const n = nearestWalkable(tc, tr, 8);
        if (!n) return [];
        tc = n.c; tr = n.r;
      }
      const cacheKey = sc + ',' + sr + '>' + tc + ',' + tr;
      const hit = pathCache.get(cacheKey);
      if (hit && hit.v === pathVersion) return hit.path.slice();
      const cells = astarCells(sc, sr,
        function (c, r) { return c === tc && r === tr; },
        function (c, r) { return Math.abs(c - tc) + Math.abs(r - tr); });
      const path = cells ? cells.map(function (cell) { return { x: cell[0] + 0.5, y: cell[1] + 0.5 }; }) : [];
      if (pathCache.size > 5000) pathCache = new Map(); // 兜底防膨胀
      pathCache.set(cacheKey, { v: pathVersion, path: path });
      return path.slice();
    }

    // 攻击/读条的"接近路径"：目标可以是点（塔/骷髅/领主）或多格实体（墙/门）
    // range 内且不是目标格本身的可走格即算到达
    function findApproachPath(sx, sy, range, px, py, tiles) {
      const sc = Math.floor(sx), sr = Math.floor(sy);
      const goal = function (c, r) {
        if (!walkCell(c, r)) return false;
        if (tiles) {
          let m = Infinity;
          for (let i = 0; i < tiles.length; i++) {
            if (tiles[i][1] === c && tiles[i][0] === r) return false; // 墙/门格本身不可站
            m = Math.min(m, dist(c + 0.5, r + 0.5, tiles[i][1] + 0.5, tiles[i][0] + 0.5));
          }
          return m <= range + 0.05;
        }
        if (Math.floor(px) === c && Math.floor(py) === r) return false; // 不站上目标格
        return dist(c + 0.5, r + 0.5, px, py) <= range + 0.05;
      };
      const cells = astarCells(sc, sr, goal,
        function (c, r) { return Math.max(0, dist(c + 0.5, r + 0.5, px, py) - range); });
      return cells ? cells.map(function (cell) { return { x: cell[0] + 0.5, y: cell[1] + 0.5 }; }) : null;
    }

    function setPath(e, path) {
      e._path = path;
      e._pathIdx = path && path.length > 1 ? 1 : 0; // 第 0 点是本格中心，直接迈向下一点
    }

    // =============================================================
    // 目标解析与距离
    // =============================================================
    function resolveTarget(id) {
      if (id === 'wall') return state.wall.alive ? state.wall : null;
      if (id === 'gate') return state.gate.alive ? state.gate : null;
      for (let i = 0; i < towers.length; i++) if (towers[i].id === id) return towers[i].alive ? towers[i] : null;
      for (let i = 0; i < state.skeletons.length; i++) {
        if (state.skeletons[i].id === id) return state.skeletons[i].state !== 'dead' ? state.skeletons[i] : null;
      }
      return null;
    }
    function isBuildingTarget(t) { return t === state.wall || t === state.gate || t._kind === 'tower'; }
    // 到目标的距离：墙/门取最近格子中心
    function distToTarget(u, t) {
      if (t === state.wall || t === state.gate) {
        let m = Infinity;
        for (let i = 0; i < t.tiles.length; i++) {
          m = Math.min(m, dist(u.x, u.y, t.tiles[i][1] + 0.5, t.tiles[i][0] + 0.5));
        }
        return m;
      }
      return dist(u.x, u.y, t.x, t.y);
    }
    function targetAimPos(t) { return { x: t.cx != null && (t === state.wall || t === state.gate) ? t.cx : t.x, y: t.cy != null && (t === state.wall || t === state.gate) ? t.cy : t.y }; }

    // =============================================================
    // 单位
    // =============================================================
    function makeUnit(type, x, y) {
      const cfg = CONFIG.UNITS[type];
      const u = {
        id: ++unitSeq,
        type: type,
        name: cfg.name,
        x: x, y: y,
        hp: cfg.hp, maxHp: cfg.hp,
        speed: cfg.speed,
        state: 'idle',
        targetId: null,
        channel: null,
        fearT: 0, slowT: 0, atkCd: 0, onHigh: false,
        _cfg: cfg,
        _path: null, _pathIdx: 0, _repathT: 0,
        _pursue: false, _order: null,
        _dotAcc: 0, _dotT: 0, _slowMult: 1, _deadT: 0,
      };
      state.units.push(u);
      return u;
    }
    function effRange(u) {
      // 射手站 ^ 格射程 +2（合同规则 2）
      let r = u._cfg.range;
      if (u.onHigh && u._cfg.highBonus) r += u._cfg.highBonus;
      return r;
    }
    function effSpeed(u) { return u.speed * (u.slowT > 0 ? u._slowMult : 1); }
    function aliveUnits() {
      const out = [];
      for (let i = 0; i < state.units.length; i++) if (state.units[i].state !== 'dead') out.push(state.units[i]);
      return out;
    }
    function nearestAliveUnit(x, y) {
      let best = null, bd = Infinity;
      for (let i = 0; i < state.units.length; i++) {
        const u = state.units[i];
        if (u.state === 'dead') continue;
        const d = dist(x, y, u.x, u.y);
        if (d < bd) { bd = d; best = u; }
      }
      return best;
    }
    function nearestUnitInRange(x, y, range) {
      let best = null, bd = Infinity;
      for (let i = 0; i < state.units.length; i++) {
        const u = state.units[i];
        if (u.state === 'dead') continue;
        const d = dist(x, y, u.x, u.y);
        if (d <= range && d < bd) { bd = d; best = u; }
      }
      return best;
    }

    // =============================================================
    // 骷髅
    // =============================================================
    function cellOccupied(c, r) {
      const x = c + 0.5, y = r + 0.5;
      if (dist(state.lord.x, state.lord.y, x, y) < 0.55) return true;
      let i;
      for (i = 0; i < state.units.length; i++) {
        if (state.units[i].state !== 'dead' && dist(state.units[i].x, state.units[i].y, x, y) < 0.55) return true;
      }
      for (i = 0; i < state.skeletons.length; i++) {
        if (state.skeletons[i].state !== 'dead' && dist(state.skeletons[i].x, state.skeletons[i].y, x, y) < 0.55) return true;
      }
      return false;
    }
    // 在墓碑附近找空格爬出骷髅，发 skeleton-rise
    // owner：复活塔召唤的骷髅记入其子代名单（撞墙惊动/密道伏击的不算）
    // 家锚点 _home（守卫 AI）：复活塔子代 → 塔位置；事件刷的 → 刷它的墓碑
    function spawnSkeletonNear(tomb, owner) {
      const tr = tomb[0], tc = tomb[1];
      for (let rad = 0; rad <= 2; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
            const c = tc + dc, r = tr + dr;
            if (!walkCell(c, r) || cellOccupied(c, r)) continue;
            const x = c + 0.5, y = r + 0.5;
            const s = {
              id: 's' + (++skelSeq),
              x: x, y: y,
              hp: CONFIG.SKELETON.hp, maxHp: CONFIG.SKELETON.hp,
              state: 'idle', atkCd: 0,
              _kind: 'skel', _path: null, _pathIdx: 0, _repathT: 0, _deadT: 0,
              _owner: owner || null,
              _home: owner ? { x: owner.x, y: owner.y } : { x: tc + 0.5, y: tr + 0.5 },
            };
            if (owner) owner._children.push(s);
            state.skeletons.push(s);
            push({ type: 'skeleton-rise', skel: s, x: x, y: y });
            return s;
          }
        }
      }
      return null;
    }

    // =============================================================
    // 伤害与死亡
    // =============================================================
    function addSoul(delta) {
      state.soul += delta;
      if (delta > 0) state.stats.soulEarned += delta;
      push({ type: 'soul-change', delta: delta, soul: state.soul });
    }
    function interruptChannel(u) {
      if (u.channel) { u.channel = null; if (u.state === 'channel') u.state = 'idle'; }
    }
    function damageUnit(u, amount) {
      if (!u || u.state === 'dead' || amount <= 0) return;
      u.hp -= amount;
      interruptChannel(u); // 读条中受伤即打断，进度清零（合同规则 6/7）
      push({ type: 'hit', x: u.x, y: u.y, amount: Math.round(amount), kind: 'unit', crit: false });
      if (u.hp <= 0) {
        u.hp = 0;
        u.state = 'dead';
        u.channel = null;
        u._path = null;
        u._deadT = 1.2; // 尸体短暂保留供渲染碎骨
        push({ type: 'unit-die', unit: u });
      }
    }
    function damageLord(amount) {
      if (state.lord.hp <= 0 || amount <= 0) return;
      state.lord.hp -= amount;
      // hit.kind 没有 lord 类别，归入 'unit'（表现层按坐标区分即可）
      push({ type: 'hit', x: state.lord.x, y: state.lord.y, amount: Math.round(amount), kind: 'unit', crit: false });
    }
    function damageTower(t, amount) {
      if (!t.alive || amount <= 0) return;
      t.hp -= amount;
      push({ type: 'hit', x: t.x, y: t.y, amount: Math.round(amount), kind: 'tower', crit: false });
      if (t.hp <= 0) {
        t.hp = 0;
        t.alive = false;
        state.stats.towersDown++;
        state.kills++;
        addSoul(CONFIG.ECONOMY.towerBounty); // 拆塔 +50
        push({ type: 'tower-down', tower: t });
      }
    }
    function damageWall(amount) {
      const w = state.wall;
      if (!w.alive || amount <= 0) return;
      w.hp -= amount;
      push({ type: 'hit', x: w.cx, y: w.cy, amount: Math.round(amount), kind: 'wall', crit: false });
      if (w.hp <= 0) {
        w.hp = 0;
        w.alive = false;
        state.kills++;
        pathVersion++;            // 通行格局变化，寻路缓存整体失效
        pathCache.clear();
        addSoul(CONFIG.WALL.bounty); // 破墙 +20
        push({ type: 'wall-break' });
        spawnWallAmbush();        // 撞破惊动墓地：立即刷 6 只骷髅（合同规则 8）
      }
    }
    function damageGate(amount) {
      const g = state.gate;
      if (!g.alive || amount <= 0) return;
      g.hp -= amount;
      push({ type: 'hit', x: g.cx, y: g.cy, amount: Math.round(amount), kind: 'gate', crit: false });
      // 门的归零与 win 判定统一在 checkEnd 处理
    }
    function damageSkel(s, amount) {
      if (!s || s.state === 'dead' || amount <= 0) return;
      s.hp -= amount;
      push({ type: 'hit', x: s.x, y: s.y, amount: Math.round(amount), kind: 'skel', crit: false });
      if (s.hp <= 0) {
        s.hp = 0;
        s.state = 'dead';
        s._deadT = 1.0;
        // 复活塔子代死亡：从塔的存活子代计数中移除（不管跑到哪都计入，死亡即 -1）
        if (s._owner) {
          const idx = s._owner._children.indexOf(s);
          if (idx >= 0) s._owner._children.splice(idx, 1);
          s._owner = null;
        }
        state.stats.skeletonsKilled++;
        state.kills++;
        push({ type: 'skeleton-die', skel: s });
      }
    }
    function dealDamage(target, amount) {
      if (target === state.wall) return damageWall(amount);
      if (target === state.gate) return damageGate(amount);
      if (target._kind === 'tower') return damageTower(target, amount);
      return damageSkel(target, amount);
    }

    // =============================================================
    // 事件性刷怪
    // =============================================================
    // 撞破骨墙：立即从墓地墓碑刷 6 只骷髅
    function spawnWallAmbush() {
      for (let i = 0; i < CONFIG.WALL.ambushCount; i++) {
        const tomb = tombPoints[(Math.random() * tombPoints.length) | 0];
        spawnSkeletonNear(tomb);
      }
    }
    // 密道伏击波：从离密道出口（行14,列41）最近的墓碑爬出
    function spawnAmbushWave(wave) {
      let best = null, bd = Infinity;
      for (let i = 0; i < tombPoints.length; i++) {
        const d = dist(tombPoints[i][1] + 0.5, tombPoints[i][0] + 0.5, exitX, exitY);
        if (d < bd) { bd = d; best = tombPoints[i]; }
      }
      if (!best) return;
      for (let i = 0; i < CONFIG.TERRAIN.ambushPerWave; i++) spawnSkeletonNear(best);
      push({ type: 'ambush', wave: wave, x: best[1] + 0.5, y: best[0] + 0.5 });
    }

    // =============================================================
    // 弹道（纯表现用：伤害在出手瞬间结算，弹道只做视觉）
    // =============================================================
    function addProjectile(x0, y0, x1, y1, kind) {
      const d = dist(x0, y0, x1, y1);
      state.projectiles.push({
        id: ++projSeq,
        x0: x0, y0: y0, x1: x1, y1: y1,
        t: 0, dur: Math.max(0.08, d / 14), // 弹速约 14 格/秒
        kind: kind, hit: false,
        _grace: 0,
      });
    }
    function updateProjectiles(dt) {
      const arr = state.projectiles;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        if (!p.hit) {
          p.t += dt;
          if (p.t >= p.dur) { p.hit = true; p._grace = 0.12; } // 命中帧留 0.12s 供渲染做命中闪
        } else {
          p._grace -= dt;
          if (p._grace <= 0) arr.splice(i, 1);
        }
      }
    }

    // =============================================================
    // 恐惧
    // =============================================================
    function applyFear(u, dur) {
      if (u.state === 'dead' || u._cfg.fearImmune) return; // 巨魔免疫恐惧（合同规则 9）
      interruptChannel(u);                                  // 恐惧强制移动 → 读条打断
      u.fearT = Math.max(u.fearT, dur);
      u.state = 'fear';
      u._path = null;
      u.targetId = null;
    }
    // 恐惧中朝入口 S 逃跑（不可控、不攻击），撞墙时沿墙滑动
    function flee(u, dt) {
      const tx = spawnCell.c + 0.5, ty = spawnCell.r + 0.5;
      const dx = tx - u.x, dy = ty - u.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.3) return;
      const sp = effSpeed(u) * dt;
      const nx = u.x + dx / d * sp, ny = u.y + dy / d * sp;
      if (isWalkable(nx, ny)) { u.x = nx; u.y = ny; }
      else if (isWalkable(nx, u.y)) { u.x = nx; }
      else if (isWalkable(u.x, ny)) { u.y = ny; }
    }

    // =============================================================
    // 读条（挖掘 / 封印）
    // =============================================================
    function startChannel(u, kind) {
      if (u.channel && u.channel.kind === kind) return; // 已在读同种条，不重置进度
      const already = state.units.some(function (v) {
        return v !== u && v.state === 'channel' && v.channel && v.channel.kind === kind;
      });
      u.channel = { kind: kind, t: 0, need: kind === 'dig' ? CONFIG.TERRAIN.digTime : CONFIG.TERRAIN.sealTime };
      u.state = 'channel';
      u._path = null;
      if (!already) push({ type: kind === 'dig' ? 'dig-start' : 'seal-start' });
    }
    function finishChannels(kind) {
      for (let i = 0; i < state.units.length; i++) {
        const u = state.units[i];
        if (u.channel && u.channel.kind === kind) { u.channel = null; if (u.state === 'channel') u.state = 'idle'; }
      }
    }
    function updateChannel(u, dt) {
      const ch = u.channel;
      const pt = ch.kind === 'dig' ? state.dig : state.rift;
      if (dist(u.x, u.y, pt.x, pt.y) > 1.8) { // 被挤离目标 → 读条作废
        interruptChannel(u);
        return;
      }
      ch.t += dt;
      if (ch.t >= ch.need) {
        if (ch.kind === 'dig') completeDig(); else completeSeal();
        finishChannels(ch.kind);
      }
    }
    function completeDig() {
      state.dig.opened = true;
      state.dig.progress = 1;
      pathVersion++;                 // 密道全格变为可通行，重算寻路
      pathCache.clear();
      push({ type: 'dig-done' });
      // 密道伏击：挖开瞬间第 1 波，6 秒后第 2 波（合同规则 6）
      spawnAmbushWave(1);
      if (CONFIG.TERRAIN.ambushWaves > 1) {
        pendingSpawns.push({ at: state.time + CONFIG.TERRAIN.ambushInterval, wave: 2 });
      }
    }
    function completeSeal() {
      state.rift.sealed = true;
      state.rift.progress = 1;
      towerSpdMult = 0.85;           // 全场亡灵塔攻速 -15%（攻击间隔 = 基础 / 0.85）
      // 复活塔复活间隔立即翻倍（6s → 12s），当前节拍也重起
      for (let i = 0; i < towers.length; i++) {
        if (towers[i].key === 'r' && towers[i].alive) towers[i]._reviveCd = towers[i]._cfg.sealedInterval;
      }
      addSoul(CONFIG.ECONOMY.sealBonus); // +80 魂能
      push({ type: 'seal-done' });
    }
    // 全局读条进度 = 当前读条者里的最大值，无人在读则归零（读条对象本身已完成则恒 1）
    function refreshChannelProgress() {
      let dp = 0, sp = 0;
      for (let i = 0; i < state.units.length; i++) {
        const u = state.units[i];
        if (u.state !== 'channel' || !u.channel) continue;
        const p = Math.min(1, u.channel.t / u.channel.need);
        if (u.channel.kind === 'dig') dp = Math.max(dp, p); else sp = Math.max(sp, p);
      }
      state.dig.progress = state.dig.opened ? 1 : dp;
      state.rift.progress = state.rift.sealed ? 1 : sp;
    }

    // =============================================================
    // 单位攻击
    // =============================================================
    function unitAttack(u, target) {
      const cfg = u._cfg;
      u.atkCd = cfg.as;
      const aim = targetAimPos(target);
      let dmg = cfg.atk;
      if (cfg.buildingMult && isBuildingTarget(target)) dmg *= cfg.buildingMult; // 巨魔对塔/墙/门 ×3
      if (u.type === 'archer') addProjectile(u.x, u.y, aim.x, aim.y, 'bone');
      if (cfg.aoe) {
        // 瘟疫使徒：毒云溅射，主目标周围敌人全吃
        addProjectile(u.x, u.y, aim.x, aim.y, 'poison');
        dealDamage(target, dmg);
        let i;
        for (i = 0; i < state.skeletons.length; i++) {
          const s = state.skeletons[i];
          if (s !== target && s.state !== 'dead' && dist(s.x, s.y, aim.x, aim.y) <= AOE_RADIUS) dealDamage(s, dmg);
        }
        for (i = 0; i < towers.length; i++) {
          const t = towers[i];
          if (t !== target && t.alive && dist(t.x, t.y, aim.x, aim.y) <= AOE_RADIUS) dealDamage(t, dmg);
        }
      } else {
        dealDamage(target, dmg);
      }
    }
    // 静止自动索敌：射程内最近敌人（塔/墙/门/骷髅）
    function nearestEnemyInRange(u) {
      const range = effRange(u);
      let best = null, bd = Infinity, i, d;
      for (i = 0; i < state.skeletons.length; i++) {
        const s = state.skeletons[i];
        if (s.state === 'dead') continue;
        d = dist(u.x, u.y, s.x, s.y);
        if (d <= range + 0.05 && d < bd) { bd = d; best = s; }
      }
      for (i = 0; i < towers.length; i++) {
        const t = towers[i];
        if (!t.alive) continue;
        d = dist(u.x, u.y, t.x, t.y);
        if (d <= range + 0.05 && d < bd) { bd = d; best = t; }
      }
      if (state.wall.alive) {
        d = distToTarget(u, state.wall);
        if (d <= range + 0.05 && d < bd) { bd = d; best = state.wall; }
      }
      if (state.gate.alive) {
        d = distToTarget(u, state.gate);
        if (d <= range + 0.05 && d < bd) { bd = d; best = state.gate; }
      }
      return best;
    }

    // =============================================================
    // 单位逐帧更新
    // =============================================================
    function followPath(e, dt, speed) {
      const path = e._path;
      if (!path || e._pathIdx >= path.length) return true;
      const wp = path[e._pathIdx];
      const dx = wp.x - e.x, dy = wp.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const step = speed * dt;
      if (d <= Math.max(step, 0.08)) { e.x = wp.x; e.y = wp.y; e._pathIdx++; }
      else { e.x += dx / d * step; e.y += dy / d * step; }
      return e._pathIdx >= path.length;
    }

    // 毒塔毒雾 + 洼地毒沼：持续掉血 + 减速；使徒免疫；多毒源取最高不叠加（合同规则 3）
    function updatePoison(u, dt) {
      let dps = 0, slow = 0;
      if (!u._cfg.poisonImmune) {
        for (let i = 0; i < towers.length; i++) {
          const t = towers[i];
          if (t.alive && t.key === 'p' && dist(u.x, u.y, t.x, t.y) <= t.range) {
            dps = Math.max(dps, t._cfg.dps);
            slow = Math.max(slow, t._cfg.slow);
          }
        }
        if (charAt(Math.floor(u.x), Math.floor(u.y)) === '~') {
          dps = Math.max(dps, CONFIG.TERRAIN.marshDps);
          slow = Math.max(slow, CONFIG.TERRAIN.marshSlow);
        }
      }
      if (dps > 0) {
        u.slowT = 0.25;          // 中毒期间持续刷新减速标记
        u._slowMult = 1 - slow;
        u._dotAcc += dps * dt;
        u._dotT += dt;
        if (u._dotT >= 0.5) {    // DoT 每 0.5s 结算一次跳字，避免事件刷屏
          const amt = u._dotAcc;
          u._dotAcc = 0; u._dotT = 0;
          damageUnit(u, amt);    // 中毒也算受伤 → 会打断读条
        }
        tutorial('tut-range');   // 单位首次中毒
      } else if (u.slowT > 0) {
        u.slowT -= dt;
      }
    }

    function updateMove(u, dt) {
      const arrived = followPath(u, dt, effSpeed(u));
      if (!arrived) return;
      u._path = null;
      if (u._order) { // 挖掘/封印指令：到位后开始读条
        const kind = u._order.kind;
        u._order = null;
        const pt = kind === 'dig' ? state.dig : state.rift;
        if (dist(u.x, u.y, pt.x, pt.y) <= 1.6) { startChannel(u, kind); return; }
      }
      u.state = 'idle';
    }

    function updateAttackOrder(u, dt) {
      const target = resolveTarget(u.targetId);
      if (!target) { u.state = 'idle'; u.targetId = null; u._pursue = false; return; }
      const range = effRange(u);
      if (distToTarget(u, target) <= range + 0.05) {
        u._path = null;
        if (u.atkCd <= 0) unitAttack(u, target);
      } else if (u._pursue) {
        // 指令攻击：追击至射程内（节流重寻路）
        u._repathT -= dt;
        if (!u._path || u._repathT <= 0) {
          const aim = targetAimPos(target);
          const tiles = (target === state.wall || target === state.gate) ? target.tiles : null;
          const path = findApproachPath(u.x, u.y, range, aim.x, aim.y, tiles);
          if (path) setPath(u, path);
          u._repathT = 0.35;
        }
        if (u._path) followPath(u, dt, effSpeed(u));
      } else {
        // 自动索敌的目标跑出射程（如骷髅跑开）→ 回到待机重新索敌
        u.state = 'idle';
        u.targetId = null;
      }
    }

    function updateUnit(u, dt) {
      if (u.state === 'dead') { u._deadT -= dt; return; }
      u.onHigh = charAt(Math.floor(u.x), Math.floor(u.y)) === '^';
      updatePoison(u, dt);
      // 恐惧：朝入口逃跑，不可控、不攻击（合同规则 4）
      if (u.fearT > 0) {
        u.fearT -= dt;
        if (u.state !== 'fear') { u.state = 'fear'; interruptChannel(u); }
        flee(u, dt);
        if (u.fearT <= 0) { u.fearT = 0; u.state = 'idle'; u._path = null; }
        return;
      }
      switch (u.state) {
        case 'channel': updateChannel(u, dt); break;
        case 'move': updateMove(u, dt); break;
        case 'attack': updateAttackOrder(u, dt); break;
        default: {
          // 静止时自动攻击射程内最近敌人（合同规则 1）
          const t = nearestEnemyInRange(u);
          if (t) { u.state = 'attack'; u.targetId = t.id; u._pursue = false; }
        }
      }
      if (u.atkCd > 0) u.atkCd -= dt;
    }

    // =============================================================
    // 骷髅 AI（设计终审修订：守卫/tether，替代原合同规则 10 的全图追击）
    // =============================================================
    // 骷髅 tether/守卫 AI（设计终审：骷髅是塔的卫兵，不是进攻部队）
    // · 只追击位于"家锚点 guardRadius 内"的我方单位，范围内选最近的
    // · 追击中允许离开家半径，但每帧以"目标是否仍在家半径内"重新判定，出圈立即放弃
    // · 范围内无我方单位 → 走回家锚点附近待机（state 复用 move/idle）
    // · 永不攻击领主：索敌只扫 state.units，领主天然不在名单里
    function updateSkel(s, dt) {
      if (s.state === 'dead') { s._deadT -= dt; return; }
      if (s.atkCd > 0) s.atkCd -= dt;
      const home = s._home;
      const R = CONFIG.SKELETON.range;
      const GR = CONFIG.SKELETON.guardRadius;
      const u = nearestUnitInRange(home.x, home.y, GR); // 以家为圆心索敌，不含领主
      if (u) {
        if (dist(s.x, s.y, u.x, u.y) <= R + 0.05) {
          s.state = 'attack';
          s._path = null;
          if (s.atkCd <= 0) {
            s.atkCd = CONFIG.SKELETON.as;
            damageUnit(u, CONFIG.SKELETON.atk);
          }
          return;
        }
        s.state = 'move'; // 追击范围内的目标
        s._repathT -= dt;
        if (!s._path || s._repathT <= 0) {
          const path = findApproachPath(s.x, s.y, R, u.x, u.y, null);
          if (path) setPath(s, path);
          s._repathT = 0.5;
        }
        if (s._path) followPath(s, dt, CONFIG.SKELETON.speed);
        return;
      }
      // 脱战：回家锚点附近待机
      if (dist(s.x, s.y, home.x, home.y) > 1.2) {
        s.state = 'move';
        s._repathT -= dt;
        if (!s._path || s._repathT <= 0) {
          const path = findPath(s.x, s.y, home.x, home.y);
          if (path.length) setPath(s, path);
          s._repathT = 0.8;
        }
        if (s._path) {
          followPath(s, dt, CONFIG.SKELETON.speed);
          if (dist(s.x, s.y, home.x, home.y) <= 1.2) { s.state = 'idle'; s._path = null; }
        }
      } else {
        s.state = 'idle';
        s._path = null;
      }
    }

    // =============================================================
    // 塔逐帧更新
    // =============================================================
    function updateTowers(dt) {
      for (let i = 0; i < towers.length; i++) {
        const t = towers[i];
        if (!t.alive) continue;
        const cfg = t._cfg;
        if (t.key === 'a') {
          // 骨刺箭塔：单体物理，封印后攻速 -15%
          t.atkCd -= dt;
          if (t.atkCd <= 0) {
            const u = nearestUnitInRange(t.x, t.y, t.range);
            if (u) {
              t.atkCd = cfg.interval / towerSpdMult;
              addProjectile(t.x, t.y, u.x, u.y, 'bone');
              damageUnit(u, cfg.dmg);
            } else {
              t.atkCd = 0.15; // 无目标时快速复检
            }
          }
        } else if (t.key === 'w') {
          // 哀嚎尖塔：每 4 秒脉冲，射程内非免疫单位恐惧 2 秒（合同规则 4）
          t.atkCd -= dt;
          if (t.atkCd <= 0) {
            let any = false;
            for (let j = 0; j < state.units.length; j++) {
              const u = state.units[j];
              if (u.state === 'dead' || u._cfg.fearImmune) continue;
              if (dist(u.x, u.y, t.x, t.y) <= t.range) {
                applyFear(u, cfg.fearDur);
                push({ type: 'fear', x: u.x, y: u.y });
                any = true;
              }
            }
            t.atkCd = any ? cfg.interval / towerSpdMult : 0.5; // 没人中时短复检，进场即吼
          }
        } else if (t.key === 'r') {
          // 墓地复活塔：每 6 秒（封印后 12 秒）补足骷髅至 3 只（合同规则 5）
          // 规模上限按"它自己召唤且仍存活的子代"计——不管骷髅跑到哪都计入，
          // 撞墙惊动/密道伏击刷的骷髅不占名额，墓地有压力但不再无限累积
          t._reviveCd -= dt;
          if (t._reviveCd <= 0) {
            t._reviveCd = state.rift.sealed ? cfg.sealedInterval : cfg.interval;
            const inRangeTombs = tombPoints.filter(function (tp) {
              return dist(tp[1] + 0.5, tp[0] + 0.5, t.x, t.y) <= t.range;
            });
            if (inRangeTombs.length) {
              // 防御性过滤：子代被绕过 damageSkel 直接置死时也能自愈
              t._children = t._children.filter(function (s) { return s.state !== 'dead'; });
              let need = cfg.maxSkel - t._children.length;
              while (need-- > 0) {
                const tomb = inRangeTombs[(Math.random() * inRangeTombs.length) | 0];
                if (spawnSkeletonNear(tomb, t)) {
                  if (!firstReviveDone) { firstReviveDone = true; tutorial('tut-aoe'); } // 复活塔首次复活
                } else break; // 墓碑周围没空格了，下拍再试
              }
            }
          }
        }
        // 'p' 腐尸毒塔：持续毒雾，在各单位的 updatePoison 里结算
      }
    }

    // =============================================================
    // 同格分离抖动：避免单位完全重叠
    // =============================================================
    function tryNudge(e, dx, dy) {
      const nx = e.x + dx, ny = e.y + dy;
      if (isWalkable(nx, ny)) { e.x = nx; e.y = ny; return; }
      if (isWalkable(nx, e.y)) { e.x = nx; return; }
      if (isWalkable(e.x, ny)) { e.y = ny; }
    }
    function separate(list, dt) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.state === 'dead') continue;
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (b.state === 'dead') continue;
          let dx = b.x - a.x, dy = b.y - a.y;
          let d = Math.sqrt(dx * dx + dy * dy);
          if (d >= 0.55) continue;
          if (d < 0.001) { // 完全重叠：按 id 哈希给确定方向
            const ang = (hashId(a.id) % 360) * Math.PI / 180;
            dx = Math.cos(ang); dy = Math.sin(ang); d = 1;
          }
          const pushLen = (0.55 - d) * 2.0 * dt;
          tryNudge(a, -dx / d * pushLen, -dy / d * pushLen);
          tryNudge(b, dx / d * pushLen, dy / d * pushLen);
        }
      }
    }

    // =============================================================
    // 教学触发（合同规则 12：六个触发点，各发一次）
    // =============================================================
    function tutorial(id) {
      if (state.tutorialSeen[id]) return;
      state.tutorialSeen[id] = true;
      let text = '';
      for (let i = 0; i < CONFIG.TUTORIALS.length; i++) if (CONFIG.TUTORIALS[i].id === id) { text = CONFIG.TUTORIALS[i].text; break; }
      push({ type: 'tutorial', id: id, text: text });
    }
    function checkTutorials() {
      const us = state.units;
      let i, j, u;
      // 单位首次进箭塔射程 → tut-tank
      if (!state.tutorialSeen['tut-tank']) {
        outer:
        for (i = 0; i < us.length; i++) {
          u = us[i];
          if (u.state === 'dead') continue;
          for (j = 0; j < towers.length; j++) {
            const t = towers[j];
            if (t.alive && t.key === 'a' && dist(u.x, u.y, t.x, t.y) <= t.range) { tutorial('tut-tank'); break outer; }
          }
        }
      }
      // 射手首次站上高地 → tut-high
      if (!state.tutorialSeen['tut-high']) {
        for (i = 0; i < us.length; i++) {
          u = us[i];
          if (u.state !== 'dead' && u.type === 'archer' && u.onHigh) { tutorial('tut-high'); break; }
        }
      }
      // 首次下达对骨墙攻击或撞上 → tut-wall（cmdAttack 里也触发一次）
      if (!state.tutorialSeen['tut-wall'] && state.wall.alive) {
        outer2:
        for (i = 0; i < us.length; i++) {
          u = us[i];
          if (u.state === 'dead') continue;
          for (j = 0; j < state.wall.tiles.length; j++) {
            if (dist(u.x, u.y, state.wall.tiles[j][1] + 0.5, state.wall.tiles[j][0] + 0.5) <= 1.3) { tutorial('tut-wall'); break outer2; }
          }
        }
      }
      // 单位首次接近裂隙 6 格内 → tut-rift
      if (!state.tutorialSeen['tut-rift']) {
        for (i = 0; i < us.length; i++) {
          u = us[i];
          if (u.state !== 'dead' && dist(u.x, u.y, state.rift.x, state.rift.y) <= 6) { tutorial('tut-rift'); break; }
        }
      }
      // tut-range 在 updatePoison 里触发；tut-aoe 在复活塔首次复活时触发
    }

    // =============================================================
    // 胜负判定（合同规则 11）
    // =============================================================
    function checkEnd() {
      if (state.gate.alive && state.gate.hp <= 0) {
        state.gate.hp = 0;
        state.gate.alive = false;
        state.kills++;
        push({ type: 'gate-down' });
      }
      if (!state.gate.alive) {
        state.phase = 'won';
        push({ type: 'win' });
        return;
      }
      if (state.lord.hp <= 0) {
        state.lord.hp = 0;
        state.phase = 'lost';
        push({ type: 'lose' });
        return;
      }
      // 全场无我方存活单位且魂能买不起最便宜的兵 → 败北
      let anyAlive = false;
      for (let i = 0; i < state.units.length; i++) if (state.units[i].state !== 'dead') { anyAlive = true; break; }
      if (!anyAlive && state.soul < MIN_UNIT_COST) {
        state.phase = 'lost';
        push({ type: 'lose' });
      }
    }

    // =============================================================
    // 指令 API
    // =============================================================
    function validUnits(ids) {
      const list = Array.isArray(ids) ? ids : Array.from(ids || []);
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const id = list[i];
        for (let j = 0; j < state.units.length; j++) {
          if (state.units[j].id === id && state.units[j].state !== 'dead') { out.push(state.units[j]); break; }
        }
      }
      return out;
    }
    function notBattle() { return state.phase !== 'battle'; }
    // 恐惧中的单位不可控（合同规则 4）：从指令名单中剔除；
    // 若名单中全部被恐惧则显式拒绝 + cmd-denied，不再静默吞指令
    function ableUnits(us) {
      return us.filter(function (u) { return u.fearT <= 0; });
    }

    function spawnUnit(type) {
      if (notBattle()) return deny('战斗已结束');
      const cfg = CONFIG.UNITS[type];
      if (!cfg) return deny('未知兵种: ' + type);
      if (state.soul < cfg.cost) return deny('魂能不足');
      // 从 S 点入场：找入口附近空格
      const cell = findFreeCellNear(spawnCell.c, spawnCell.r, 6);
      if (!cell) return deny('入口被堵住了');
      addSoul(-cfg.cost);
      const u = makeUnit(type, cell.c + 0.5, cell.r + 0.5);
      push({ type: 'unit-spawn', unit: u });
      return { ok: true };
    }

    function cmdMove(ids, x, y) {
      if (notBattle()) return deny('战斗已结束');
      const us = validUnits(ids);
      if (!us.length) return deny('没有可指挥的单位');
      const able = ableUnits(us); // 恐惧中的单位不可指挥
      if (!able.length) return deny('恐惧中，无法指挥');
      if (!isFinite(x) || !isFinite(y)) return deny('目标点无效');
      let moved = 0;
      for (let i = 0; i < able.length; i++) {
        const u = able[i];
        interruptChannel(u); // 新移动指令打断读条
        // 阵型偏移：黄金角螺旋散开，避免全军挤一格
        const a = i * 2.399963, rad = 0.5 * Math.sqrt(i);
        const path = findPath(u.x, u.y, x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        if (path.length) {
          setPath(u, path);
          u.state = 'move';
          u._order = null;
          u.targetId = null;
          u._pursue = false;
          moved++;
        }
      }
      return moved ? { ok: true } : deny('无法到达目标点');
    }

    function cmdAttack(ids, targetId) {
      if (notBattle()) return deny('战斗已结束');
      const us = validUnits(ids);
      if (!us.length) return deny('没有可指挥的单位');
      const able = ableUnits(us); // 恐惧中的单位不可指挥
      if (!able.length) return deny('恐惧中，无法指挥');
      const target = resolveTarget(targetId);
      if (!target) return deny('目标无效');
      for (let i = 0; i < able.length; i++) {
        const u = able[i];
        interruptChannel(u);
        u.state = 'attack';
        u.targetId = targetId;
        u._pursue = true;      // 指令攻击：追击至射程内
        u._path = null;
        u._repathT = 0;
        u._order = null;
      }
      if (targetId === 'wall') tutorial('tut-wall'); // 首次对骨墙下攻击令
      return { ok: true };
    }

    // 挖掘/封印共用：把单位派到目标点 1.5 格内的空位，到位后读条
    // 落格打分：目标格本身优先，其余按距离升序；毒沼 ~ 格降权 100
    // （只有目标周围全是毒沼时才退而求其次），避免非免疫单位站进毒沼被 DoT 打断
    function issueChannelOrder(us, kind, px, py) {
      const bc = Math.floor(px), br = Math.floor(py);
      const cells = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const c = bc + dc, r = br + dr;
          if (!walkCell(c, r)) continue;
          const d = dist(c + 0.5, r + 0.5, px, py);
          if (d > 1.5) continue;
          cells.push({ c: c, r: r, score: d + (MAP[r][c] === '~' ? 100 : 0) });
        }
      }
      if (!cells.length) return deny('目标旁没有可站的位置');
      cells.sort(function (a, b) { return a.score - b.score; });
      // 离目标最近的单位分最好的格子
      const sorted = us.slice().sort(function (a, b) {
        return dist(a.x, a.y, px, py) - dist(b.x, b.y, px, py);
      });
      let issued = 0;
      for (let i = 0; i < sorted.length; i++) {
        const u = sorted[i];
        if (u.channel && u.channel.kind === kind) { issued++; continue; } // 已在读条的不打断
        interruptChannel(u);
        u._order = { kind: kind };
        u.targetId = null;
        u._pursue = false;
        const cell = cells[i % cells.length];
        // 已站在分派格上 → 原地读条；否则寻路过去（毒沼里的单位也会被拉到好格）
        if (Math.floor(u.x) === cell.c && Math.floor(u.y) === cell.r) {
          startChannel(u, kind);
          issued++;
          continue;
        }
        const path = findPath(u.x, u.y, cell.c + 0.5, cell.r + 0.5);
        if (path.length) { setPath(u, path); u.state = 'move'; issued++; }
        else u._order = null;
      }
      return issued ? { ok: true } : deny('无法接近目标');
    }

    function cmdDig(ids) {
      if (notBattle()) return deny('战斗已结束');
      if (state.dig.opened) return deny('密道已经挖开');
      const all = validUnits(ids);
      const able = ableUnits(all); // 恐惧中的单位不可指挥
      if (all.length && !able.length) return deny('恐惧中，无法指挥');
      const us = able.filter(function (u) { return u._cfg.canDig; });
      if (!us.length) return deny('只有食尸鬼能挖掘');
      return issueChannelOrder(us, 'dig', state.dig.x, state.dig.y);
    }

    function cmdSeal(ids) {
      if (notBattle()) return deny('战斗已结束');
      if (state.rift.sealed) return deny('裂隙已封印');
      const all = validUnits(ids);
      if (!all.length) return deny('没有可指挥的单位');
      const us = ableUnits(all); // 恐惧中的单位不可指挥
      if (!us.length) return deny('恐惧中，无法指挥');
      return issueChannelOrder(us, 'seal', state.rift.x, state.rift.y);
    }

    // 领主技能「尸潮」：领主周围空格召唤食尸鬼，冷却 60 秒
    function castLord() {
      if (notBattle()) return deny('战斗已结束');
      if (state.lord.abilityCd > 0) return deny('技能冷却中');
      const summon = CONFIG.LORD.abilitySummon;
      const types = Object.keys(summon);
      let spawned = 0;
      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        for (let k = 0; k < summon[type]; k++) {
          const cell = findFreeCellNear(Math.floor(state.lord.x), Math.floor(state.lord.y), 3);
          if (!cell) break;
          const u = makeUnit(type, cell.c + 0.5, cell.r + 0.5);
          push({ type: 'unit-spawn', unit: u });
          spawned++;
        }
      }
      if (!spawned) return deny('领主周围没有空位');
      state.lord.abilityCd = CONFIG.LORD.abilityCd;
      push({ type: 'lord-ability' });
      return { ok: true };
    }

    // 入口附近找空格（出兵 / 尸潮共用）
    function findFreeCellNear(c, r, maxR) {
      for (let rad = 0; rad <= maxR; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
            const cc = c + dc, rr = r + dr;
            if (walkCell(cc, rr) && !cellOccupied(cc, rr)) return { c: cc, r: rr };
          }
        }
      }
      return null;
    }

    // =============================================================
    // 查询助手（合同）
    // =============================================================
    function towerAt(cx, cy) {
      const c = Math.floor(cx), r = Math.floor(cy);
      let i;
      for (i = 0; i < towers.length; i++) {
        if (towers[i].alive && Math.floor(towers[i].x) === c && Math.floor(towers[i].y) === r) return towers[i];
      }
      if (state.wall.alive) {
        for (i = 0; i < state.wall.tiles.length; i++) {
          if (state.wall.tiles[i][1] === c && state.wall.tiles[i][0] === r) return state.wall;
        }
      }
      if (state.gate.alive) {
        for (i = 0; i < state.gate.tiles.length; i++) {
          if (state.gate.tiles[i][1] === c && state.gate.tiles[i][0] === r) return state.gate;
        }
      }
      return null;
    }
    function unitAt(px, py, r) {
      let best = null, bd = Infinity;
      for (let i = 0; i < state.units.length; i++) {
        const u = state.units[i];
        if (u.state === 'dead') continue;
        const d = dist(px, py, u.x, u.y);
        if (d <= r && d < bd) { bd = d; best = u; }
      }
      return best;
    }
    function unitsInRect(x0, y0, x1, y1) {
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
      const out = [];
      for (let i = 0; i < state.units.length; i++) {
        const u = state.units[i];
        if (u.state !== 'dead' && u.x >= xa && u.x <= xb && u.y >= ya && u.y <= yb) out.push(u);
      }
      return out;
    }

    // =============================================================
    // 主更新
    // =============================================================
    function update(dt) {
      if (state.phase !== 'battle') return; // 胜负已分，冻结战场
      if (!(dt > 0)) return;
      state.time += dt;
      if (state.lord.abilityCd > 0) state.lord.abilityCd = Math.max(0, state.lord.abilityCd - dt);

      // 计划刷怪（密道伏击第二波）
      for (let i = pendingSpawns.length - 1; i >= 0; i--) {
        if (pendingSpawns[i].at <= state.time) {
          const sp = pendingSpawns.splice(i, 1)[0];
          spawnAmbushWave(sp.wave);
        }
      }

      updateTowers(dt);
      for (let i = 0; i < state.units.length; i++) updateUnit(state.units[i], dt);
      for (let i = 0; i < state.skeletons.length; i++) updateSkel(state.skeletons[i], dt);
      separate(state.units, dt);
      separate(state.skeletons, dt);
      refreshChannelProgress();
      updateProjectiles(dt);

      // 尸体短暂保留供渲染碎骨，随后移除
      state.units = state.units.filter(function (u) { return u.state !== 'dead' || u._deadT > 0; });
      state.skeletons = state.skeletons.filter(function (s) { return s.state !== 'dead' || s._deadT > 0; });

      checkTutorials();
      checkEnd();
    }

    // =============================================================
    // 初始兵力：按 CONFIG.INITIAL_ARMY 在 S 点附近空格排布，领主站 S 格
    // =============================================================
    (function placeInitialArmy() {
      // BFS 从 S 点向外取可行走格（跳过 S 格本身——领主站那里）
      const seen = new Set([spawnCell.r * COLS + spawnCell.c]);
      const queue = [[spawnCell.c, spawnCell.r]];
      const cells = [];
      while (queue.length) {
        const cur = queue.shift();
        const c = cur[0], r = cur[1];
        if (c !== spawnCell.c || r !== spawnCell.r) cells.push({ c: c, r: r });
        for (let i = 0; i < 4; i++) {
          const nc = c + DIRS[i][0], nr = r + DIRS[i][1];
          const nk = nr * COLS + nc;
          if (!walkCell(nc, nr) || seen.has(nk)) continue;
          seen.add(nk);
          queue.push([nc, nr]);
        }
      }
      let idx = 0;
      const types = Object.keys(CONFIG.INITIAL_ARMY);
      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        for (let k = 0; k < CONFIG.INITIAL_ARMY[type]; k++) {
          while (idx < cells.length && cellOccupied(cells[idx].c, cells[idx].r)) idx++;
          if (idx >= cells.length) return;
          const cell = cells[idx++];
          const u = makeUnit(type, cell.c + 0.5, cell.r + 0.5);
          push({ type: 'unit-spawn', unit: u });
        }
      }
    })();

    // =============================================================
    // 对外 API（合同）
    // =============================================================
    return {
      state: state,
      events: events,
      update: update,
      spawnUnit: spawnUnit,
      cmdMove: cmdMove,
      cmdAttack: cmdAttack,
      cmdDig: cmdDig,
      cmdSeal: cmdSeal,
      castLord: castLord,
      tileChar: tileChar,
      isWalkable: isWalkable,
      findPath: findPath,
      towerAt: towerAt,
      unitAt: unitAt,
      unitsInRect: unitsInRect,
    };
  }

  root.GAME.Engine = { createGame: createGame };
})(typeof window !== 'undefined' ? window : globalThis);

// =============================================================
// 白骨迎宾道 · input.js —— 鼠标选择 / 智能右键指令 / 快捷键（UI 程序）
// 渲染层读 GAME.Input.state；指令一律走合同 API（失败由引擎发 cmd-denied）。
// =============================================================
(function (root) {
  'use strict';
  root.GAME = root.GAME || {};

  // 渲染同事直接读这里（合同规定的形状）
  const state = {
    selectedIds: new Set(),   // Set<number>
    hoverTile: null,          // {x,y} 整数格 | null
    dragRect: null,           // {x0,y0,x1,y1} 格坐标浮点 | null
    orderMarker: null,        // {x,y,t,kind} | null
  };

  let canvas = null;
  let game = null;
  let CFG = null;

  const DRAG_THRESHOLD = 0.35;  // 格：按下后位移超过才算框选
  const CLICK_RADIUS = 0.6;     // 格：左键点选 / 右键点骷髅判定半径

  let leftDown = false;
  let dragging = false;
  let downPos = null;           // 左键按下处（格坐标浮点）
  let downShift = false;

  function attach(cv, g) {
    canvas = cv;
    game = g;
    CFG = root.GAME.CONFIG;

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mouseleave', function () { state.hoverTile = null; });
    root.addEventListener('mousemove', onMouseMove);   // 拖出画布也能继续框选
    root.addEventListener('mouseup', onMouseUp);
    root.addEventListener('keydown', onKeyDown);

    // 死单位自动从选择集剔除（每帧）
    const tick = function () {
      pruneSelection();
      root.requestAnimationFrame(tick);
    };
    root.requestAnimationFrame(tick);
  }

  // ---------------- 坐标换算 ----------------
  // canvas 可能被 CSS 缩放：用 getBoundingClientRect 比例换算回像素，再除 TILE 得格坐标
  function toGrid(e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !canvas.width || !canvas.height) return null;
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x: px / CFG.TILE, y: py / CFG.TILE };
  }

  function inside(p) {
    return p && p.x >= 0 && p.x < CFG.COLS && p.y >= 0 && p.y < CFG.ROWS;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // ---------------- 左键：点选 / 框选 ----------------

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const p = toGrid(e);
    if (!inside(p)) return;
    e.preventDefault();
    leftDown = true;
    dragging = false;
    downPos = p;
    downShift = e.shiftKey;
  }

  function onMouseMove(e) {
    const p = toGrid(e);
    state.hoverTile = inside(p) ? { x: Math.floor(p.x), y: Math.floor(p.y) } : null;

    if (!leftDown || !downPos || !p) return;
    const dx = Math.abs(p.x - downPos.x);
    const dy = Math.abs(p.y - downPos.y);
    if (!dragging && Math.max(dx, dy) > DRAG_THRESHOLD) dragging = true;
    if (dragging) {
      state.dragRect = {
        x0: clamp(Math.min(downPos.x, p.x), 0, CFG.COLS),
        y0: clamp(Math.min(downPos.y, p.y), 0, CFG.ROWS),
        x1: clamp(Math.max(downPos.x, p.x), 0, CFG.COLS),
        y1: clamp(Math.max(downPos.y, p.y), 0, CFG.ROWS),
      };
    }
  }

  function onMouseUp(e) {
    if (e.button !== 0 || !leftDown) return;
    leftDown = false;
    const additive = downShift || e.shiftKey;

    if (dragging && state.dragRect) {
      const r = state.dragRect;
      applySelection(normIds(game.unitsInRect(r.x0, r.y0, r.x1, r.y1)), additive);
    } else if (downPos) {
      const u = game.unitAt(downPos.x, downPos.y, CLICK_RADIUS);
      if (u) {
        applySelection([u.id], additive);
      } else if (!additive) {
        state.selectedIds.clear();   // 点空地清空选择
      }
    }

    dragging = false;
    downPos = null;
    state.dragRect = null;
    pruneSelection();
  }

  // unitsInRect 返回单位数组或 id 数组都兼容
  function normIds(res) {
    if (!res) return [];
    return Array.from(res)
      .map(function (v) { return typeof v === 'number' ? v : (v && v.id); })
      .filter(function (v) { return typeof v === 'number'; });
  }

  function applySelection(ids, additive) {
    if (!additive) state.selectedIds.clear();
    ids.forEach(function (id) { state.selectedIds.add(id); });
  }

  // ---------------- 右键：智能指令 ----------------

  function onContextMenu(e) {
    e.preventDefault();   // 阻止右键菜单
    if (!game || !game.state || game.state.phase !== 'battle') return;
    const p = toGrid(e);
    if (!inside(p)) return;
    smartOrder(p);
  }

  function smartOrder(p) {
    pruneSelection();
    if (!state.selectedIds.size) return;   // 无选中单位时右键无效

    const ids = Array.from(state.selectedIds);
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    let res = null;
    let kind = null;

    const tw = game.towerAt(cx, cy);
    if (tw) {
      // 活塔 / 骨墙('wall') / 亡者之门('gate') → 攻击
      res = game.cmdAttack(ids, tw.id);
      kind = 'attack';
    } else {
      const sk = skeletonNear(p.x, p.y, CLICK_RADIUS);
      if (sk) {
        res = game.cmdAttack(ids, sk.id);
        kind = 'attack';
      } else {
        const ch = game.tileChar(cx, cy);
        if (ch === '?') {
          res = game.cmdDig(ids);
          kind = 'dig';
        } else if (ch === 'X') {
          res = game.cmdSeal(ids);
          kind = 'seal';
        } else if (game.isWalkable(cx, cy)) {
          res = game.cmdMove(ids, cx + 0.5, cy + 0.5);   // 落到格中心
          kind = 'move';
        }
        // 其余（岩壁/未挖开密道/未破骨墙等不可通行格）→ 不下单
      }
    }

    if (res && res.ok) {
      state.orderMarker = { x: p.x, y: p.y, t: performance.now(), kind: kind };
    }
  }

  function skeletonNear(x, y, r) {
    const skels = game.state.skeletons || [];
    let best = null;
    let bestD = r;
    for (let i = 0; i < skels.length; i++) {
      const s = skels[i];
      if (s.hp <= 0 || s.state === 'dead') continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d <= bestD) { best = s; bestD = d; }
    }
    return best;
  }

  // ---------------- 快捷键 ----------------

  function onKeyDown(e) {
    if (e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!game || !game.state || game.state.phase !== 'battle') return;

    const k = e.key;
    const types = Object.keys(CFG.UNITS);
    for (let i = 0; i < types.length; i++) {
      if (CFG.UNITS[types[i]].hotkey === k) {   // 1-4 出兵
        game.spawnUnit(types[i]);
        return;
      }
    }
    if (k === 'q' || k === 'Q') {               // 领主技能「尸潮」
      game.castLord();
      return;
    }
    if (k === 'Escape') {                       // 清空选择
      state.selectedIds.clear();
      state.dragRect = null;
      leftDown = false;
      dragging = false;
    }
  }

  // ---------------- 选择集清理 ----------------

  function pruneSelection() {
    if (!game || !game.state || !state.selectedIds.size) return;
    const units = game.state.units;
    const dead = [];
    state.selectedIds.forEach(function (id) {
      let alive = false;
      for (let i = 0; i < units.length; i++) {
        if (units[i].id === id && units[i].state !== 'dead') { alive = true; break; }
      }
      if (!alive) dead.push(id);
    });
    dead.forEach(function (id) { state.selectedIds.delete(id); });
  }

  root.GAME.Input = { state: state, attach: attach };
})(typeof window !== 'undefined' ? window : globalThis);

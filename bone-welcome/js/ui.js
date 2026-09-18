// =============================================================
// 白骨迎宾道 · ui.js —— HUD / toast / 结算遮罩（UI 程序）
// 只读 game.state；指令一律走合同 API；DOM 只动 index.html 既有 id。
// =============================================================
(function (root) {
  'use strict';
  root.GAME = root.GAME || {};

  let game = null;
  let CFG = null;
  const els = {};          // DOM 缓存
  const cardEls = {};      // type -> { root, badge }
  const seenTuts = {};     // 教学 toast 去重（每 id 全关一次）
  let audioOn = true;
  let audioBooted = false;
  let gameOver = false;

  const TOAST_LIMIT = 4;     // 同屏最多 4 条
  const TOAST_MS = 3500;     // 3.5 秒自动消失

  function $(id) { return document.getElementById(id); }

  function fmtTime(t) {
    t = Math.max(0, Math.floor(t || 0));
    const m = Math.floor(t / 60);
    const s = t % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ---------------- init ----------------

  function init(g) {
    game = g;
    CFG = root.GAME.CONFIG;

    els.soul = $('soul-count');
    els.timer = $('timer');
    els.btnAudio = $('btn-audio');
    els.btnRestart = $('btn-restart');
    els.btnOverlayRestart = $('btn-overlay-restart');
    els.cards = $('unit-cards');
    els.lordAbility = $('lord-ability');
    els.lordHp = $('lord-hp');
    els.selInfo = $('selection-info');
    els.toasts = $('toasts');
    els.overlay = $('overlay');
    els.overlayTitle = $('overlay-title');
    els.overlaySub = $('overlay-sub');

    buildCards();
    buildLordPanel();

    els.btnRestart.addEventListener('click', function () { location.reload(); });
    els.btnOverlayRestart.addEventListener('click', function () { location.reload(); });

    els.btnAudio.addEventListener('click', function () {
      bootAudio();
      const A = root.GAME.Audio;
      if (A && A.setEnabled) audioOn = !!A.setEnabled(!audioOn);
      els.btnAudio.textContent = audioOn ? '🔊' : '🔇';
      els.btnAudio.classList.toggle('muted', !audioOn);
    });

    // AudioContext 需要用户手势：首次点击页面任意处初始化音频
    document.addEventListener('pointerdown', bootAudio, { once: true });
  }

  function bootAudio() {
    if (audioBooted) return;
    audioBooted = true;
    const A = root.GAME.Audio;
    if (A && A.init) A.init();
  }

  function buildCards() {
    els.cards.innerHTML = '';
    Object.keys(CFG.UNITS).forEach(function (type) {
      const u = CFG.UNITS[type];
      const card = document.createElement('div');
      card.className = 'unit-card';
      card.dataset.desc = u.desc;   // CSS tooltip 一句话描述
      card.innerHTML =
        '<span class="uc-badge">0</span>' +
        '<span class="uc-key">' + u.hotkey + '</span>' +
        '<div class="uc-name">' + u.name + '</div>' +
        '<div class="uc-cost">◆ ' + u.cost + '</div>';
      card.addEventListener('click', function () { game.spawnUnit(type); });
      els.cards.appendChild(card);
      cardEls[type] = { root: card, badge: card.querySelector('.uc-badge') };
    });
  }

  function buildLordPanel() {
    els.lordAbility.innerHTML =
      '<span class="la-label">' + CFG.LORD.abilityName + ' (' + CFG.LORD.abilityKey + ')</span>' +
      '<span class="la-cd"></span>' +
      '<span class="la-cd-num"></span>';
    els.lordCd = els.lordAbility.querySelector('.la-cd');
    els.lordCdNum = els.lordAbility.querySelector('.la-cd-num');
    els.lordAbility.addEventListener('click', function () { game.castLord(); });
  }

  // ---------------- update（每帧） ----------------

  function update() {
    if (!game || !game.state) return;
    const s = game.state;

    // 魂能 / 计时
    els.soul.textContent = Math.floor(s.soul);
    els.timer.textContent = fmtTime(s.time);

    // 领主血条
    const hpPct = s.lord.maxHp > 0 ? Math.max(0, s.lord.hp / s.lord.maxHp) : 0;
    els.lordHp.style.width = (hpPct * 100).toFixed(1) + '%';
    els.lordHp.classList.toggle('low', hpPct < 0.3);

    // 领主技能冷却（剩余秒数 + 进度遮罩）
    const cd = Math.max(0, s.lord.abilityCd || 0);
    if (cd > 0.05) {
      els.lordAbility.classList.add('cooling');
      els.lordAbility.classList.remove('ready');
      els.lordCd.style.height = Math.min(100, (cd / CFG.LORD.abilityCd) * 100).toFixed(1) + '%';
      els.lordCdNum.textContent = Math.ceil(cd);
    } else {
      els.lordAbility.classList.remove('cooling');
      els.lordAbility.classList.add('ready');
      els.lordCd.style.height = '0%';
      els.lordCdNum.textContent = '';
    }

    // 兵种卡：魂能不足置灰 + 存活数量徽章
    Object.keys(cardEls).forEach(function (type) {
      const c = cardEls[type];
      c.root.classList.toggle('disabled', s.soul < CFG.UNITS[type].cost);
      let alive = 0;
      for (let i = 0; i < s.units.length; i++) {
        const u = s.units[i];
        if (u.type === type && u.state !== 'dead') alive++;
      }
      c.badge.textContent = alive;
    });

    updateSelectionInfo(s);
  }

  function updateSelectionInfo(s) {
    const input = root.GAME.Input && root.GAME.Input.state;
    const byId = {};
    for (let i = 0; i < s.units.length; i++) byId[s.units[i].id] = s.units[i];

    const sel = [];
    if (input && input.selectedIds) {
      input.selectedIds.forEach(function (id) {
        const u = byId[id];
        if (u && u.state !== 'dead') sel.push(u);
      });
    }

    if (!sel.length) {
      els.selInfo.innerHTML =
        '<span class="si-hint">左键 选择 / 框选 · 右键 移动 / 攻击 · <b>?</b> 挖掘 · <b>X</b> 封印</span>';
      return;
    }

    const counts = {};
    let hp = 0, maxHp = 0;
    sel.forEach(function (u) {
      counts[u.type] = (counts[u.type] || 0) + 1;
      hp += Math.max(0, u.hp);
      maxHp += u.maxHp;
    });
    const parts = Object.keys(CFG.UNITS)
      .filter(function (t) { return counts[t]; })
      .map(function (t) { return CFG.UNITS[t].name + ' ×' + counts[t]; });

    els.selInfo.innerHTML =
      '<span class="si-units">' + parts.join('　') + '</span>' +
      '<span class="si-hp">总血量 ' + Math.ceil(hp) + ' / ' + maxHp + '</span>';
  }

  // ---------------- handleEvent ----------------

  function handleEvent(e) {
    if (!e || !e.type) return;
    switch (e.type) {
      case 'soul-change':
        flashSoul();
        break;
      case 'tutorial':
        if (!seenTuts[e.id]) {
          seenTuts[e.id] = true;
          toast(e.text, 'info');
        }
        break;
      case 'tower-down':
        toast(e.tower.name + ' 已摧毁 +' + CFG.ECONOMY.towerBounty + ' 魂能', 'good');
        break;
      case 'wall-break':
        toast('骨墙 已撞破 +' + CFG.WALL.bounty + ' 魂能——墓地里有什么醒了', 'info');
        break;
      case 'dig-done':
        toast('密道已挖开——当心伏击', 'info');
        break;
      case 'seal-done':
        toast('灵魂裂隙 已封印 +' + CFG.ECONOMY.sealBonus + ' 魂能', 'good');
        break;
      case 'ambush':
        toast('墓碑炸裂——伏击！', 'bad');
        break;
      case 'cmd-denied':
        toast(e.msg || '指令被拒绝', 'bad small');
        break;
      case 'win':
        showOverlay(true);
        break;
      case 'lose':
        showOverlay(false);
        break;
    }
  }

  // ---------------- toast ----------------

  function toast(text, kind) {
    const box = els.toasts;
    if (!box) return;
    while (box.children.length >= TOAST_LIMIT) box.removeChild(box.firstChild);
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, TOAST_MS - 300);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, TOAST_MS);
  }

  function flashSoul() {
    els.soul.classList.remove('flash');
    void els.soul.offsetWidth;   // 强制 reflow，重触发动画
    els.soul.classList.add('flash');
  }

  // ---------------- 结算 ----------------

  function showOverlay(win) {
    if (gameOver) return;
    gameOver = true;
    const s = game.state;
    els.overlayTitle.textContent = win ? CFG.WIN_TITLE : CFG.LOSE_TITLE;
    els.overlaySub.textContent = win ? CFG.WIN_SUB : CFG.LOSE_SUB;
    const stats = document.createElement('div');
    stats.className = 'ov-stats';
    stats.textContent =
      '用时 ' + fmtTime(s.time) +
      ' · 拆塔 ' + s.stats.towersDown +
      ' · 骷髅击杀 ' + s.stats.skeletonsKilled +
      ' · 剩余魂能 ' + Math.floor(s.soul);
    els.overlaySub.appendChild(stats);
    els.overlay.classList.remove('hidden');
    els.overlay.classList.toggle('win', win);
    els.overlay.classList.toggle('lose', !win);
  }

  root.GAME.UI = { init: init, update: update, handleEvent: handleEvent };
})(typeof window !== 'undefined' ? window : globalThis);

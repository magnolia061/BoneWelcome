// =============================================================
// 白骨迎宾道 · fx.js —— 粒子 / 伤害数字 / 震屏（表现程序）
// API: GAME.FX.init(game) / handleEvent(e) / update(dt)
//      / drawOverlay(ctx) / applyShake(ctx)
// =============================================================
(function (root) {
  'use strict';
  root.GAME = root.GAME || {};

  // ---- 内部状态 ----
  const S = {
    game: null,
    time: 0,
    parts: [],    // 粒子
    nums: [],     // 伤害数字
    rings: [],    // 冲击波环
    shakeAmp: 0,  // 当前震屏幅度（px）
    bubbleAcc: 0, // 毒泡生成计时
  };

  function P() { return root.GAME.CONFIG.PALETTE; }
  function TILE() { return root.GAME.CONFIG.TILE; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function reset() {
    S.parts.length = 0;
    S.nums.length = 0;
    S.rings.length = 0;
    S.shakeAmp = 0;
    S.time = 0;
    S.bubbleAcc = 0;
  }

  // ---- 粒子生成器 ----
  // 通用粒子: 坐标为格（浮点），速度 格/秒，size 为 px
  function spawn(p) { S.parts.push(p); }

  // 命中白闪：短促白点四散
  function burstHit(x, y) {
    const c = P();
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(1.5, 3.5);
      spawn({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        grav: 6, bounce: false, floorY: 0, life: 0, ttl: rand(0.12, 0.22),
        size: rand(1.2, 2.2), color: c.bone, alpha: 1 });
    }
  }

  // 碎骨：骨白碎屑 + 重力 + 落地弹跳
  function burstBones(x, y, n, tint) {
    const c = P();
    const floorY = y + rand(0.2, 0.45); // 落地点略低于躯干
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), sp = rand(1.2, 4.2);
      spawn({ kind: 'shard', x: x + rand(-0.15, 0.15), y: y - 0.1,
        vx: Math.cos(a) * sp * rand(0.4, 1), vy: Math.sin(a) * sp,
        grav: 14, bounce: true, floorY,
        life: 0, ttl: rand(0.5, 0.9), size: rand(1.5, 3.2),
        color: (tint && Math.random() < 0.35) ? tint : c.bone,
        alpha: 1, rot: rand(0, Math.PI * 2), vrot: rand(-8, 8) });
    }
  }

  // 尘土：挖掘/建筑崩塌
  function burstDust(x, y, n) {
    const c = P();
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(0.4, 1.6);
      spawn({ kind: 'dust', x: x + rand(-0.3, 0.3), y: y + rand(-0.2, 0.2),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(0.6, 1.4),
        grav: -1.2, bounce: false, floorY: 0,
        life: 0, ttl: rand(0.5, 1.0), size: rand(3, 7),
        color: c.tomb, alpha: 0.55 });
    }
  }

  // 毒雾泡泡：由 update 持续生成（毒塔射程内）
  function spawnPoisonBubble(x, y) {
    const c = P();
    spawn({ kind: 'bubble', x, y, vx: rand(-0.15, 0.15), vy: rand(-0.9, -0.5),
      grav: 0, bounce: false, floorY: 0,
      life: 0, ttl: rand(0.7, 1.3), size: rand(1.5, 3.5),
      color: c.poison, alpha: 0.7 });
  }

  // 冲击波环
  function ring(x, y, r1, color, ttl, width) {
    S.rings.push({ x, y, r0: 0.2, r1, t: 0, ttl, color, width: width || 3 });
  }

  // 伤害数字
  function dmgNum(x, y, amount, gold) {
    S.nums.push({ x: x + rand(-0.2, 0.2), y: y - 0.4,
      text: String(Math.max(1, Math.round(amount))),
      t: 0, ttl: 0.8, gold: !!gold });
    // 同帧数字过多时丢弃最旧，防糊屏
    if (S.nums.length > 40) S.nums.splice(0, S.nums.length - 40);
  }

  // 震屏：叠加取最大
  function shake(amp) { S.shakeAmp = Math.max(S.shakeAmp, amp); }

  // =============================================================
  // 事件分发
  // =============================================================
  function handleEvent(e) {
    if (!e || !e.type) return;
    const c = P();
    const st = S.game && S.game.state;
    switch (e.type) {
      case 'hit': {
        burstHit(e.x, e.y);
        const structural = e.kind === 'tower' || e.kind === 'wall' || e.kind === 'gate';
        dmgNum(e.x, e.y, e.amount, e.crit || structural);
        if (e.kind === 'gate') shake(3);   // 亡者之门受击小震
        break;
      }
      case 'unit-die':
        if (e.unit) burstBones(e.unit.x, e.unit.y, 9, c.player);
        break;
      case 'skeleton-die':
        if (e.skel) burstBones(e.skel.x, e.skel.y, 8);
        break;
      case 'skeleton-rise': {
        // 骷髅爬出：灵魂青微闪 + 小尘土
        const x = e.x, y = e.y;
        if (typeof x === 'number') {
          ring(x, y, 0.9, c.soul, 0.45, 2);
          burstDust(x, y, 4);
        }
        break;
      }
      case 'tower-down':
        if (e.tower) {
          burstBones(e.tower.x, e.tower.y, 16);
          burstDust(e.tower.x, e.tower.y, 10);
        }
        shake(7);
        break;
      case 'wall-break':
        if (st && st.wall) { burstBones(st.wall.cx, st.wall.cy, 20); burstDust(st.wall.cx, st.wall.cy, 12); }
        shake(9);
        break;
      case 'gate-down':
        if (st && st.gate) { burstBones(st.gate.cx, st.gate.cy, 26); burstDust(st.gate.cx, st.gate.cy, 16); }
        shake(11);
        break;
      case 'dig-done':
        if (st && st.dig) burstDust(st.dig.x, st.dig.y, 18);
        shake(3);
        break;
      case 'ambush':
        // 墓碑爆裂：碎骨 + 尘土 + 小环
        if (typeof e.x === 'number') {
          burstBones(e.x, e.y, 10);
          burstDust(e.x, e.y, 8);
          ring(e.x, e.y, 1.4, c.tomb, 0.5, 3);
        }
        shake(3);
        break;
      case 'seal-done':
        if (st && st.rift) ring(st.rift.x, st.rift.y, 5, c.soul, 0.9, 4);
        shake(4);
        break;
      case 'lord-ability':
        if (st && st.lord) ring(st.lord.x, st.lord.y, 4, c.player, 0.8, 5);
        shake(4);
        break;
      case 'fear':
        // 恐惧脉冲：轻微灵魂青涟漪（螺旋/惊叹号由 Render 画在单位头顶）
        if (typeof e.x === 'number') ring(e.x, e.y, 1.6, c.soul, 0.5, 2);
        break;
      case 'win':
        if (st && st.gate) ring(st.gate.cx, st.gate.cy, 7, c.gold, 1.2, 5);
        shake(7);
        break;
      case 'lose':
        if (st && st.lord) ring(st.lord.x, st.lord.y, 4, c.danger, 1.0, 4);
        shake(6);
        break;
      default:
        break; // tutorial / cmd-denied / soul-change 等不归 FX
    }
  }

  // =============================================================
  // 帧更新
  // =============================================================
  function update(dt) {
    S.time += dt;
    const st = S.game && S.game.state;

    // 毒塔射程内持续冒毒泡（限频）
    S.bubbleAcc += dt;
    if (st && S.bubbleAcc > 0.12) {
      S.bubbleAcc = 0;
      for (const tw of st.towers) {
        if (!tw.alive || tw.key !== 'p') continue;
        const a = rand(0, Math.PI * 2), r = rand(0.5, tw.range);
        spawnPoisonBubble(tw.x + Math.cos(a) * r, tw.y + Math.sin(a) * r * 0.7);
      }
    }

    // 粒子积分
    const parts = S.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.ttl) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vrot) p.rot += p.vrot * dt;
      if (p.bounce && p.y > p.floorY) {
        p.y = p.floorY;
        p.vy = -p.vy * 0.45;       // 落地弹跳衰减
        p.vx *= 0.7;
        if (Math.abs(p.vy) < 0.5) p.vy = 0;
      }
    }

    // 伤害数字
    const nums = S.nums;
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = nums[i];
      n.t += dt;
      n.y -= dt * 1.1;             // 上浮
      if (n.t >= n.ttl) nums.splice(i, 1);
    }

    // 冲击波环
    const rings = S.rings;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.ttl) rings.splice(i, 1);
    }

    // 震屏指数衰减
    S.shakeAmp *= Math.exp(-5 * dt);
    if (S.shakeAmp < 0.1) S.shakeAmp = 0;
  }

  // =============================================================
  // 绘制（在 Render 的坐标系内，已被 applyShake 平移）
  // =============================================================
  function drawOverlay(ctx) {
    const T = TILE();

    // 冲击波环
    for (const r of S.rings) {
      const k = r.t / r.ttl;
      const rad = (r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 2))) * T;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.5);
      ctx.beginPath();
      ctx.arc(r.x * T, r.y * T, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 粒子
    for (const p of S.parts) {
      const fade = 1 - p.life / p.ttl;
      ctx.globalAlpha = p.alpha * fade;
      ctx.fillStyle = p.color;
      const px = p.x * T, py = p.y * T;
      if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 伤害数字（字小清晰，羊皮纸色；暴击/对建筑金色）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const c = P();
    for (const n of S.nums) {
      const k = n.t / n.ttl;
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 2);
      ctx.fillStyle = n.gold ? c.gold : c.parchment;
      ctx.fillText(n.text, n.x * T, n.y * T);
    }

    ctx.globalAlpha = 1;
  }

  // 震屏偏移（Render 在 draw 开头调用）
  function applyShake(ctx) {
    if (S.shakeAmp > 0) {
      ctx.translate(rand(-S.shakeAmp, S.shakeAmp), rand(-S.shakeAmp, S.shakeAmp));
    }
  }

  function init(game) {
    S.game = game;
    reset();
  }

  root.GAME.FX = { init, handleEvent, update, drawOverlay, applyShake };
})(typeof window !== 'undefined' ? window : globalThis);

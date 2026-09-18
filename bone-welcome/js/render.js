// =============================================================
// 白骨迎宾道 · render.js —— 战场渲染（表现程序）
// API: GAME.Render.init(canvas, game) / GAME.Render.draw()
// draw 开头 GAME.FX.applyShake(ctx)，结尾 GAME.FX.drawOverlay(ctx)。
// 逻辑尺寸 64×TILE × 24×TILE（1664×624），按 devicePixelRatio 提清晰。
// =============================================================
(function (root) {
  'use strict';
  root.GAME = root.GAME || {};

  let canvas = null, ctx = null, game = null, dpr = 1;
  let riftTile = null, digTile = null;   // init 时从 MAP_ROWS 定位 X 与 ?
  let lastMarker = null, lastMarkerAt = 0; // orderMarker 本地计时（0.6s 淡出）

  function CFG() { return root.GAME.CONFIG; }
  function P() { return CFG().PALETTE; }
  function T() { return CFG().TILE; }
  function now() { return performance.now() / 1000; }

  // 色板取色 + 明暗微调（仅对 PALETTE 值做 shade，不引入外部色）
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
    const b = Math.min(255, Math.max(0, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // =============================================================
  // 地形
  // =============================================================
  function drawTerrain(st, t) {
    const tile = T(), c = P(), rows = CFG().MAP_ROWS;
    const digOpened = st.dig && st.dig.opened;
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        const x = col * tile, y = r * tile;
        switch (ch) {
          case '%': // 岩壁/门楼
            ctx.fillStyle = c.rock; ctx.fillRect(x, y, tile, tile);
            ctx.fillStyle = shade(c.rock, 14); ctx.fillRect(x, y, tile, 2);
            break;
          case ',': // 白骨大道
            ctx.fillStyle = c.road; ctx.fillRect(x, y, tile, tile);
            ctx.fillStyle = shade(c.road, 10);
            ctx.fillRect(x + tile * 0.2, y + tile * 0.45, tile * 0.6, 1.5);
            break;
          case 'S': // 入口
            ctx.fillStyle = c.road; ctx.fillRect(x, y, tile, tile);
            ctx.strokeStyle = c.gold; ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 3.5, y + 3.5, tile - 7, tile - 7);
            ctx.globalAlpha = 1;
            break;
          case '^': { // 高地：亮一档 + 边缘高光
            ctx.fillStyle = c.high; ctx.fillRect(x, y, tile, tile);
            ctx.fillStyle = shade(c.high, 26); ctx.fillRect(x, y, tile, 2.5);
            ctx.fillStyle = shade(c.high, -18); ctx.fillRect(x, y + tile - 2.5, tile, 2.5);
            ctx.globalAlpha = 0.18; ctx.strokeStyle = c.bone; ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
            ctx.globalAlpha = 1;
            break;
          }
          case 'n': // 坡道
            ctx.fillStyle = c.ramp; ctx.fillRect(x, y, tile, tile);
            ctx.fillStyle = shade(c.ramp, 20);
            ctx.beginPath();
            ctx.moveTo(x + tile * 0.3, y + tile * 0.65);
            ctx.lineTo(x + tile * 0.5, y + tile * 0.35);
            ctx.lineTo(x + tile * 0.7, y + tile * 0.65);
            ctx.fill();
            break;
          case '~': { // 洼地毒沼：深绿底 + 缓慢冒泡
            ctx.fillStyle = c.marsh; ctx.fillRect(x, y, tile, tile);
            ctx.fillStyle = shade(c.marsh, -12); ctx.fillRect(x, y + tile - 3, tile, 3);
            for (let i = 0; i < 2; i++) {
              const seed = (r * 73 + col * 131 + i * 57) % 97 / 97;
              const ph = (t * 0.5 + seed) % 1;          // 2 秒冒泡周期
              const bx = x + tile * (0.25 + 0.5 * ((seed * 7) % 1));
              const by = y + tile * (0.75 - 0.5 * ph);
              ctx.globalAlpha = 0.65 * (1 - ph);
              ctx.fillStyle = c.poison;
              ctx.beginPath(); ctx.arc(bx, by, 1.2 + 1.6 * ph, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            break;
          }
          case 'X': // 灵魂裂隙地块（呼吸光晕在 drawRiftDig 统一画）
            ctx.fillStyle = c.rift; ctx.fillRect(x, y, tile, tile);
            break;
          case '?': // 挖掘点：未挖开与平地无异 + 呼吸 '?'；挖开=洞口
            ctx.fillStyle = c.ground; ctx.fillRect(x, y, tile, tile);
            if (digOpened) drawHole(x, y, tile);
            break;
          case ':': // 密道：未挖开看不出；挖开后深色洞口/地道纹理
            if (digOpened) {
              ctx.fillStyle = c.tunnel; ctx.fillRect(x, y, tile, tile);
              drawHole(x, y, tile);
            } else {
              ctx.fillStyle = c.ground; ctx.fillRect(x, y, tile, tile);
            }
            break;
          case '#': // 骨墙格：墙体由 state.wall 统一画，这里铺底
          case 'D': // 亡者之门格：由 state.gate 统一画
            ctx.fillStyle = c.rock; ctx.fillRect(x, y, tile, tile);
            break;
          case 'T': // 墓碑
            ctx.fillStyle = c.ground; ctx.fillRect(x, y, tile, tile);
            drawTombstone(x + tile / 2, y + tile / 2, tile * 0.62, c.tomb);
            break;
          default: // '.' 平地与塔位（a/p/w/r）铺平地底
            ctx.fillStyle = c.ground; ctx.fillRect(x, y, tile, tile);
            break;
        }
      }
    }

    // 格子细分线压到很淡
    ctx.strokeStyle = c.bone; ctx.globalAlpha = 0.035; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let col = 1; col < CFG().COLS; col++) { ctx.moveTo(col * tile, 0); ctx.lineTo(col * tile, CFG().ROWS * tile); }
    for (let r = 1; r < CFG().ROWS; r++) { ctx.moveTo(0, r * tile); ctx.lineTo(CFG().COLS * tile, r * tile); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 洞口/地道纹理
  function drawHole(x, y, tile) {
    const c = P();
    ctx.fillStyle = c.rock;
    ctx.beginPath(); ctx.ellipse(x + tile / 2, y + tile / 2, tile * 0.34, tile * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(c.tunnel, 26); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x + tile / 2, y + tile / 2, tile * 0.34, tile * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = shade(c.tunnel, 18);
    ctx.fillRect(x + tile * 0.3, y + tile * 0.46, tile * 0.4, 1.5);
  }

  // 墓碑造型（复用：地形 T / 复活塔底座 / 伏击点）
  function drawTombstone(cx, cy, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.32, cy + s * 0.4);
    ctx.lineTo(cx - s * 0.32, cy - s * 0.1);
    ctx.arc(cx, cy - s * 0.1, s * 0.32, Math.PI, 0);
    ctx.lineTo(cx + s * 0.32, cy + s * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(color, -20);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.28); ctx.lineTo(cx, cy + s * 0.12);
    ctx.moveTo(cx - s * 0.14, cy - s * 0.14); ctx.lineTo(cx + s * 0.14, cy - s * 0.14);
    ctx.stroke();
  }

  // 裂隙呼吸光晕（2 秒周期）+ 挖掘点呼吸脉冲 '?'
  function drawRiftDig(st, t) {
    const tile = T(), c = P();
    const pulse = 0.5 + 0.5 * Math.sin(Math.PI * t); // 2 秒周期

    if (riftTile && !(st.rift && st.rift.sealed)) {
      const cx = (riftTile.c + 0.5) * tile, cy = (riftTile.r + 0.5) * tile;
      const rad = tile * (1.1 + 0.5 * pulse);
      const g = ctx.createRadialGradient(cx, cy, tile * 0.2, cx, cy, rad);
      g.addColorStop(0, c.soul);
      g.addColorStop(1, 'rgba(78,211,251,0)');
      ctx.globalAlpha = 0.28 + 0.3 * pulse;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = c.soul;
      ctx.beginPath(); ctx.arc(cx, cy, 2.5 + 1.5 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (riftTile) {
      // 封印后：裂隙收敛为暗纹
      const cx = (riftTile.c + 0.5) * tile, cy = (riftTile.r + 0.5) * tile;
      ctx.globalAlpha = 0.35; ctx.strokeStyle = c.soul; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, tile * 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (digTile && !(st.dig && st.dig.opened)) {
      const cx = (digTile.c + 0.5) * tile, cy = (digTile.r + 0.5) * tile;
      ctx.globalAlpha = 0.45 + 0.5 * pulse;
      ctx.fillStyle = c.parchment;
      ctx.font = 'bold 14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy);
      ctx.globalAlpha = 0.25 + 0.3 * pulse;
      ctx.strokeStyle = c.gold; ctx.lineWidth = 1.5;
      ctx.strokeRect((digTile.c + 0.12) * tile, (digTile.r + 0.12) * tile, tile * 0.76, tile * 0.76);
      ctx.globalAlpha = 1;
    }

    // 裂隙封印读条进度（state.rift.progress 0..1）
    if (riftTile && st.rift && st.rift.progress > 0 && !st.rift.sealed) {
      const cx = (riftTile.c + 0.5) * tile, cy = (riftTile.r + 0.5) * tile;
      ctx.strokeStyle = c.soul; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * st.rift.progress);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // =============================================================
  // 骨墙 / 亡者之门
  // =============================================================
  function drawWall(st) {
    const w = st.wall;
    if (!w) return;
    const tile = T(), c = P();
    const ratio = Math.max(0, w.hp / w.maxHp);
    for (const [r, col] of w.tiles) {
      const x = col * tile, y = r * tile;
      if (!w.alive) {
        // 残骸：碎骨堆
        ctx.fillStyle = shade(c.wall, -60);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x + tile * (0.25 + 0.25 * i), y + tile * (0.65 + 0.08 * (i % 2)), tile * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      // 白骨堆叠墙段：三根横向骨段
      for (let i = 0; i < 3; i++) {
        const by = y + tile * (0.22 + 0.28 * i);
        ctx.fillStyle = i % 2 ? shade(c.wall, -18) : c.wall;
        ctx.beginPath();
        ctx.ellipse(x + tile / 2, by, tile * 0.42, tile * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(c.wall, -45);
        ctx.beginPath(); ctx.arc(x + tile * 0.1, by, tile * 0.09, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + tile * 0.9, by, tile * 0.09, 0, Math.PI * 2); ctx.fill();
      }
      // 裂纹程度随 hp 下降
      const cracks = Math.floor((1 - ratio) * 4);
      ctx.strokeStyle = c.rock; ctx.lineWidth = 1.2;
      for (let i = 0; i < cracks; i++) {
        const cxx = x + tile * (0.25 + 0.2 * i);
        ctx.beginPath();
        ctx.moveTo(cxx, y + tile * 0.15);
        ctx.lineTo(cxx + 3, y + tile * 0.5);
        ctx.lineTo(cxx - 2, y + tile * 0.85);
        ctx.stroke();
      }
    }
    if (w.alive) drawHpBar(w.cx * tile, (w.tiles[0][0]) * tile - 6, tile * 1.6, ratio, c.danger);
  }

  function drawGate(st, t) {
    const g = st.gate;
    if (!g) return;
    const tile = T(), c = P();
    let minR = 1e9, maxR = -1e9, minC = 1e9, maxC = -1e9;
    for (const [r, col] of g.tiles) {
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, col); maxC = Math.max(maxC, col);
    }
    const x = minC * tile, y = minR * tile;
    const w = (maxC - minC + 1) * tile, h = (maxR - minR + 1) * tile;
    const ratio = Math.max(0, g.hp / g.maxHp);

    if (!g.alive) {
      // 门已毁：黑曜石残框 + 熄灭符文
      ctx.fillStyle = c.rock; ctx.fillRect(x + 2, y + h * 0.45, w - 4, h * 0.5);
      ctx.fillStyle = shade(c.rock, 20);
      ctx.fillRect(x + 2, y + h * 0.42, w * 0.3, h * 0.14);
      ctx.fillRect(x + w * 0.6, y + h * 0.5, w * 0.3, h * 0.12);
      ctx.globalAlpha = 0.25; ctx.strokeStyle = c.soul; ctx.lineWidth = 1;
      ctx.strokeRect(x + w * 0.2, y + h * 0.55, w * 0.6, h * 0.3);
      ctx.globalAlpha = 1;
      return;
    }

    // 2×2 黑曜石门框
    ctx.fillStyle = shade(c.rock, 10);
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = c.rock;
    ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
    ctx.strokeStyle = shade(c.tomb, -10); ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

    // 灵魂青符文（门中心发光，随时间轻微明灭）
    const cx = g.cx * tile, cy = g.cy * tile;
    const glow = 0.55 + 0.25 * Math.sin(t * 2.4);
    ctx.globalAlpha = glow;
    ctx.strokeStyle = c.soul; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, tile * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - tile * 0.3); ctx.lineTo(cx, cy + tile * 0.3);
    ctx.moveTo(cx - tile * 0.3, cy); ctx.lineTo(cx + tile * 0.3, cy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // hp 越低裂纹越多
    const cracks = Math.floor((1 - ratio) * 6);
    ctx.strokeStyle = shade(c.rock, 60); ctx.lineWidth = 1.3;
    for (let i = 0; i < cracks; i++) {
      const sx = x + w * ((i * 37 % 90) / 100 + 0.05);
      const sy = y + h * ((i * 53 % 80) / 100 + 0.05);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 5 - (i % 3) * 4, sy + 8);
      ctx.lineTo(sx + 2, sy + 14);
      ctx.stroke();
    }
    drawHpBar(cx, y - 6, w * 0.9, ratio, c.danger);
  }

  // =============================================================
  // 塔
  // =============================================================
  function drawTowers(st, t) {
    const tile = T(), c = P();
    for (const tw of st.towers) {
      const cx = tw.x * tile, cy = tw.y * tile;
      if (!tw.alive) { drawTowerWreck(cx, cy, tile); continue; }

      // 地面阴影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(cx, cy + tile * 0.32, tile * 0.42, tile * 0.14, 0, 0, Math.PI * 2); ctx.fill();

      const bone = c.bone, boneDim = shade(c.bone, -35);
      if (tw.key === 'a') {
        // 骨刺箭塔：骨刺堆（丛生尖刺）
        for (let i = -2; i <= 2; i++) {
          const hgt = tile * (1.0 - Math.abs(i) * 0.18);
          ctx.fillStyle = i % 2 ? boneDim : bone;
          ctx.beginPath();
          ctx.moveTo(cx + i * tile * 0.16 - 3, cy + tile * 0.3);
          ctx.lineTo(cx + i * tile * 0.16, cy + tile * 0.3 - hgt);
          ctx.lineTo(cx + i * tile * 0.16 + 3, cy + tile * 0.3);
          ctx.closePath(); ctx.fill();
        }
      } else if (tw.key === 'p') {
        // 腐尸毒塔：毒鼎（鼎身 + 冒毒绿泡）
        ctx.fillStyle = boneDim;
        ctx.beginPath();
        ctx.moveTo(cx - tile * 0.34, cy - tile * 0.28);
        ctx.lineTo(cx + tile * 0.34, cy - tile * 0.28);
        ctx.lineTo(cx + tile * 0.24, cy + tile * 0.3);
        ctx.lineTo(cx - tile * 0.24, cy + tile * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = bone;
        ctx.fillRect(cx - tile * 0.38, cy - tile * 0.34, tile * 0.76, tile * 0.1);
        // 毒绿冒泡
        for (let i = 0; i < 3; i++) {
          const ph = (t * 1.2 + i * 0.37) % 1;
          ctx.globalAlpha = 0.8 * (1 - ph);
          ctx.fillStyle = c.poison;
          ctx.beginPath();
          ctx.arc(cx + (i - 1) * tile * 0.13, cy - tile * (0.34 + 0.35 * ph), 1.6 + 1.8 * ph, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (tw.key === 'w') {
        // 哀嚎尖塔：高瘦方尖碑 + 顶部灵魂青火
        ctx.fillStyle = bone;
        ctx.beginPath();
        ctx.moveTo(cx - tile * 0.18, cy + tile * 0.3);
        ctx.lineTo(cx - tile * 0.09, cy - tile * 1.0);
        ctx.lineTo(cx + tile * 0.09, cy - tile * 1.0);
        ctx.lineTo(cx + tile * 0.18, cy + tile * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = boneDim;
        ctx.fillRect(cx - tile * 0.24, cy + tile * 0.22, tile * 0.48, tile * 0.1);
        const fl = 0.7 + 0.3 * Math.sin(t * 6 + tw.id);
        ctx.globalAlpha = fl; ctx.fillStyle = c.soul;
        ctx.beginPath();
        ctx.moveTo(cx, cy - tile * 1.3);
        ctx.quadraticCurveTo(cx + 4, cy - tile * 1.1, cx, cy - tile * 0.95);
        ctx.quadraticCurveTo(cx - 4, cy - tile * 1.1, cx, cy - tile * 1.3);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (tw.key === 'r') {
        // 墓地复活塔：墓碑环绕的方尖碑
        ctx.fillStyle = bone;
        ctx.beginPath();
        ctx.moveTo(cx - tile * 0.16, cy + tile * 0.18);
        ctx.lineTo(cx - tile * 0.08, cy - tile * 0.8);
        ctx.lineTo(cx + tile * 0.08, cy - tile * 0.8);
        ctx.lineTo(cx + tile * 0.16, cy + tile * 0.18);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.soul; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(cx, cy - tile * 0.86, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        drawTombstone(cx - tile * 0.4, cy + tile * 0.26, tile * 0.4, c.tomb);
        drawTombstone(cx + tile * 0.4, cy + tile * 0.26, tile * 0.4, c.tomb);
        drawTombstone(cx, cy + tile * 0.34, tile * 0.44, c.tomb);
      }

      // 塔顶小血条（骨白底 + 赤红血）
      const topY = cy - tile * (tw.key === 'w' ? 1.45 : tw.key === 'r' ? 1.05 : 0.7);
      drawHpBar(cx, topY, tile * 0.9, tw.hp / tw.maxHp, c.danger, c.bone);
    }
  }

  function drawTowerWreck(cx, cy, tile) {
    const c = P();
    ctx.fillStyle = shade(c.wall, -70);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * tile * 0.2, cy + tile * 0.2 + Math.sin(a) * tile * 0.08);
      ctx.rotate(a + 0.6);
      ctx.fillRect(-tile * 0.14, -tile * 0.045, tile * 0.28, tile * 0.09);
      ctx.restore();
    }
  }

  // =============================================================
  // 通用血条：bone 底可换色，fill 主色
  // =============================================================
  function drawHpBar(cx, topY, w, ratio, fillColor, bgColor) {
    const c = P();
    const h = 3.5;
    ctx.fillStyle = bgColor || 'rgba(233,226,200,0.35)';
    ctx.fillRect(cx - w / 2, topY, w, h);
    ctx.fillStyle = fillColor || c.danger;
    ctx.fillRect(cx - w / 2, topY, w * Math.max(0, Math.min(1, ratio)), h);
  }

  // =============================================================
  // 单位 / 领主 / 骷髅
  // =============================================================
  function unitBody(u, tile) {
    const c = P();
    const cx = u.x * tile, cy = u.y * tile;
    const s = tile * 0.36; // 单位比格子小一圈
    const base = c.player;

    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.55, s * 0.8, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();

    if (u.type === 'ghoul') {
      // 食尸鬼：小四足
      ctx.strokeStyle = shade(base, -50); ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const lx = cx - s * 0.5 + i * s * 0.33;
        ctx.moveTo(lx, cy + s * 0.1); ctx.lineTo(lx - 1.5, cy + s * 0.55);
      }
      ctx.stroke();
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.62, s * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s * 0.55, cy - s * 0.18, s * 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.bone;
      ctx.beginPath(); ctx.arc(cx + s * 0.63, cy - s * 0.22, 1.3, 0, Math.PI * 2); ctx.fill();
    } else if (u.type === 'archer') {
      // 骸骨射手：带弓人形
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.55, s * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - s * 0.2, cy - s * 0.3, s * 0.4, s * 0.75);
      ctx.strokeStyle = shade(base, -50); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx + s * 0.42, cy - s * 0.1, s * 0.5, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke();
      ctx.strokeStyle = c.parchment; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.42 + Math.cos(-Math.PI * 0.45) * s * 0.5, cy - s * 0.1 + Math.sin(-Math.PI * 0.45) * s * 0.5);
      ctx.lineTo(cx + s * 0.42 + Math.cos(Math.PI * 0.45) * s * 0.5, cy - s * 0.1 + Math.sin(Math.PI * 0.45) * s * 0.5);
      ctx.stroke();
    } else if (u.type === 'troll') {
      // 石肤巨魔：大块头
      const b = tile * 0.52;
      ctx.fillStyle = shade(base, -15);
      ctx.beginPath();
      ctx.moveTo(cx - b * 0.7, cy + b * 0.55);
      ctx.lineTo(cx - b * 0.78, cy - b * 0.25);
      ctx.quadraticCurveTo(cx, cy - b * 0.85, cx + b * 0.78, cy - b * 0.25);
      ctx.lineTo(cx + b * 0.7, cy + b * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(base, 25);
      ctx.beginPath(); ctx.arc(cx, cy - b * 0.42, b * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.bone;
      ctx.fillRect(cx - b * 0.14, cy - b * 0.48, 2.5, 2.5);
      ctx.fillRect(cx + b * 0.08, cy - b * 0.48, 2.5, 2.5);
    } else {
      // 瘟疫使徒：袍子人形
      ctx.fillStyle = shade(base, -25);
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.95);
      ctx.lineTo(cx + s * 0.55, cy + s * 0.55);
      ctx.lineTo(cx - s * 0.55, cy + s * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.72, s * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.poison;
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.72, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawUnits(st, t) {
    const tile = T(), c = P();
    const input = root.GAME.Input && root.GAME.Input.state;
    const sel = input && input.selectedIds;

    for (const u of st.units) {
      if (u.state === 'dead') continue;
      const cx = u.x * tile, cy = u.y * tile;

      // 射程圈（选中的远程单位）
      const cfg = CFG().UNITS[u.type];
      if (sel && sel.has(u.id) && cfg && cfg.range >= 3) {
        let range = cfg.range;
        if (u.onHigh && cfg.highBonus) range += cfg.highBonus;
        ctx.strokeStyle = c.tangerine; ctx.globalAlpha = 0.3; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, range * tile, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      unitBody(u, tile);

      // 头顶血条
      const topY = cy - tile * (u.type === 'troll' ? 0.72 : 0.62);
      drawHpBar(cx, topY, tile * 0.72, u.hp / u.maxHp, c.player);

      // 恐惧中：头顶螺旋 + 惊叹号
      if (u.state === 'fear' || u.fearT > 0) {
        ctx.strokeStyle = c.soul; ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2.6; a += 0.35) {
          const rr = 1 + a * 1.1;
          const px = cx + Math.cos(a + t * 7) * rr, py = topY - 9 + Math.sin(a + t * 7) * rr * 0.6;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = c.danger;
        ctx.font = 'bold 10px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('!', cx + 8, topY - 4);
      }

      // 读条中：头顶扇形进度环
      if (u.state === 'channel' && u.channel) {
        const frac = Math.max(0, Math.min(1, u.channel.t / u.channel.need));
        const col = u.channel.kind === 'seal' ? c.soul : c.gold;
        ctx.strokeStyle = 'rgba(233,226,200,0.3)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, topY - 8, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = col;
        ctx.beginPath(); ctx.arc(cx, topY - 8, 6, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      }

      // 选中：四角括号（tangerine）
      if (sel && sel.has(u.id)) {
        const d = tile * 0.55, L = tile * 0.16;
        ctx.strokeStyle = c.tangerine; ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.moveTo(cx + sx * d - sx * L, cy + sy * d);
          ctx.lineTo(cx + sx * d, cy + sy * d);
          ctx.lineTo(cx + sx * d, cy + sy * d - sy * L);
        }
        ctx.stroke();
      }
    }
  }

  function drawLord(st, t) {
    const lord = st.lord;
    if (!lord || lord.hp <= 0) return;
    const tile = T(), c = P();
    const cx = lord.x * tile, cy = lord.y * tile;

    // 技能就绪金色呼吸圈
    if (lord.abilityCd <= 0) {
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 3);
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, tile * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 基座
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, cy + tile * 0.3, tile * 0.45, tile * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.player;
    ctx.beginPath(); ctx.arc(cx, cy, tile * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(c.player, -40);
    ctx.beginPath(); ctx.arc(cx, cy, tile * 0.22, 0, Math.PI * 2); ctx.fill();

    // 旗帜
    ctx.strokeStyle = c.bone; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx + tile * 0.2, cy); ctx.lineTo(cx + tile * 0.2, cy - tile * 1.1); ctx.stroke();
    ctx.fillStyle = c.player;
    ctx.beginPath();
    ctx.moveTo(cx + tile * 0.2, cy - tile * 1.1);
    ctx.lineTo(cx + tile * 0.62, cy - tile * 0.98);
    ctx.lineTo(cx + tile * 0.2, cy - tile * 0.8);
    ctx.closePath(); ctx.fill();

    // 大王冠
    ctx.fillStyle = c.gold;
    const cw = tile * 0.4, ch = tile * 0.2, topY = cy - tile * 0.62;
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, topY + ch);
    ctx.lineTo(cx - cw / 2, topY);
    ctx.lineTo(cx - cw / 6, topY + ch * 0.55);
    ctx.lineTo(cx, topY - ch * 0.35);
    ctx.lineTo(cx + cw / 6, topY + ch * 0.55);
    ctx.lineTo(cx + cw / 2, topY);
    ctx.lineTo(cx + cw / 2, topY + ch);
    ctx.closePath(); ctx.fill();

    drawHpBar(cx, topY - ch - 6, tile * 1.3, lord.hp / lord.maxHp, c.player);
  }

  function drawSkeletons(st) {
    const tile = T(), c = P();
    for (const sk of st.skeletons) {
      if (sk.state === 'dead') continue;
      const cx = sk.x * tile, cy = sk.y * tile;
      const s = tile * 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.6, s * 0.7, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      // 骨白小骨架：颅 + 脊 + 肋
      ctx.strokeStyle = c.bone; ctx.fillStyle = c.bone; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.5, s * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.rock;
      ctx.beginPath(); ctx.arc(cx - 1.6, cy - s * 0.55, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 1.6, cy - s * 0.55, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.2); ctx.lineTo(cx, cy + s * 0.5); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const ry = cy - s * 0.05 + i * s * 0.18;
        ctx.beginPath(); ctx.moveTo(cx - s * 0.32, ry); ctx.lineTo(cx + s * 0.32, ry); ctx.stroke();
      }
      drawHpBar(cx, cy - s * 1.05, tile * 0.5, sk.hp / sk.maxHp, c.bone);
    }
  }

  // =============================================================
  // 弹道
  // =============================================================
  function drawProjectiles(st) {
    const tile = T(), c = P();
    for (const p of st.projectiles) {
      const k = Math.max(0, Math.min(1, p.t / p.dur));
      const x = (p.x0 + (p.x1 - p.x0) * k) * tile;
      const y = (p.y0 + (p.y1 - p.y0) * k) * tile;
      if (p.kind === 'poison') {
        // 毒雾弹：毒绿团 + 尾迹
        ctx.globalAlpha = 0.35; ctx.fillStyle = c.poison;
        ctx.beginPath(); ctx.arc(x - (p.x1 - p.x0) * tile * 0.08, y - (p.y1 - p.y0) * tile * 0.08, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        // 骨刺飞针：沿飞行方向的骨白短针
        const dx = p.x1 - p.x0, dy = p.y1 - p.y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len, ny = dy / len;
        ctx.strokeStyle = c.bone; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - nx * 6, y - ny * 6);
        ctx.lineTo(x + nx * 4, y + ny * 4);
        ctx.stroke();
        ctx.fillStyle = c.bone;
        ctx.beginPath(); ctx.arc(x + nx * 5, y + ny * 5, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // =============================================================
  // 输入反馈（读 GAME.Input.state）
  // =============================================================
  function drawInputFeedback(st, t) {
    const input = root.GAME.Input && root.GAME.Input.state;
    if (!input) return;
    const tile = T(), c = P();

    // 悬停格微亮
    if (input.hoverTile) {
      ctx.fillStyle = c.tangerine; ctx.globalAlpha = 0.1;
      ctx.fillRect(input.hoverTile.x * tile, input.hoverTile.y * tile, tile, tile);
      ctx.globalAlpha = 0.35; ctx.strokeStyle = c.tangerine; ctx.lineWidth = 1;
      ctx.strokeRect(input.hoverTile.x * tile + 0.5, input.hoverTile.y * tile + 0.5, tile - 1, tile - 1);
      ctx.globalAlpha = 1;
    }

    // 框选框（格坐标矩形，归一化）
    if (input.dragRect) {
      const d = input.dragRect;
      const x = Math.min(d.x0, d.x1) * tile, y = Math.min(d.y0, d.y1) * tile;
      const w = Math.abs(d.x1 - d.x0) * tile, h = Math.abs(d.y1 - d.y0) * tile;
      ctx.fillStyle = c.tangerine; ctx.globalAlpha = 0.12;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 0.7; ctx.strokeStyle = c.tangerine; ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }

    // 指令落点标记：0.6 秒淡出（本地计时，不依赖 t 的时钟域）
    if (input.orderMarker) {
      if (input.orderMarker !== lastMarker) { lastMarker = input.orderMarker; lastMarkerAt = t; }
      const age = t - lastMarkerAt;
      if (age <= 0.6) {
        const a = 1 - age / 0.6;
        const m = input.orderMarker;
        const cx = m.x * tile, cy = m.y * tile;
        const col = m.kind === 'attack' ? c.danger : c.tangerine;
        ctx.globalAlpha = a;
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        if (m.kind === 'attack') {
          ctx.beginPath(); ctx.arc(cx, cy, tile * 0.4, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx - tile * 0.55, cy); ctx.lineTo(cx - tile * 0.25, cy);
          ctx.moveTo(cx + tile * 0.25, cy); ctx.lineTo(cx + tile * 0.55, cy);
          ctx.moveTo(cx, cy - tile * 0.55); ctx.lineTo(cx, cy - tile * 0.25);
          ctx.moveTo(cx, cy + tile * 0.25); ctx.lineTo(cx, cy + tile * 0.55);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx - tile * 0.3, cy - tile * 0.3); ctx.lineTo(cx + tile * 0.3, cy + tile * 0.3);
          ctx.moveTo(cx + tile * 0.3, cy - tile * 0.3); ctx.lineTo(cx - tile * 0.3, cy + tile * 0.3);
          ctx.stroke();
          ctx.globalAlpha = a * 0.5;
          ctx.beginPath(); ctx.arc(cx, cy, tile * 0.45 * (1 + age), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    } else {
      lastMarker = null;
    }
  }

  // =============================================================
  // 主流程
  // =============================================================
  function init(cv, g) {
    canvas = cv; game = g;
    dpr = (root.devicePixelRatio || 1);
    const W = CFG().COLS * T(), H = CFG().ROWS * T();
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx = canvas.getContext('2d');

    // 预定位 X / ? 格
    const rows = CFG().MAP_ROWS;
    for (let r = 0; r < rows.length; r++) {
      for (let col = 0; col < rows[r].length; col++) {
        if (rows[r][col] === 'X') riftTile = { r, c: col };
        if (rows[r][col] === '?') digTile = { r, c: col };
      }
    }
  }

  function draw() {
    if (!ctx || !game || !game.state) return;
    const st = game.state;
    const t = now();
    const W = CFG().COLS * T(), H = CFG().ROWS * T();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P().bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    root.GAME.FX.applyShake(ctx);      // 震屏偏移

    drawTerrain(st, t);
    drawRiftDig(st, t);
    drawWall(st);
    drawGate(st, t);
    drawTowers(st, t);
    drawLord(st, t);
    drawUnits(st, t);
    drawSkeletons(st);
    drawProjectiles(st);
    drawInputFeedback(st, t);

    root.GAME.FX.drawOverlay(ctx);     // 粒子/伤害数字/冲击环
    ctx.restore();
  }

  root.GAME.Render = { init, draw };
})(typeof window !== 'undefined' ? window : globalThis);

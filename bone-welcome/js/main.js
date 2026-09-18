// =============================================================
// 白骨迎宾道 · main.js —— 启动装配 + rAF 主循环
// 加载顺序保证：config → engine → fx → audio → render → input → ui → main
// 主循环：固定步进 game.update → 排空 events 分发 FX/Audio/UI
//         → FX.update → Render.draw → UI.update
// =============================================================
(function () {
  'use strict';

  function boot() {
    const GAME = window.GAME;

    // 并行开发期友好报错：缺哪个模块一眼可见
    const need = ['CONFIG', 'Engine', 'FX', 'Audio', 'Render', 'UI', 'Input'];
    const missing = need.filter(function (k) { return !GAME[k]; });
    if (missing.length) {
      console.error('[main] 缺少模块，无法启动: ' + missing.join(', '));
      return;
    }

    const game = GAME.Engine.createGame();
    const canvas = document.getElementById('game');

    // 初始化各模块（Audio 受浏览器自动播放限制，延迟到首次用户手势）
    GAME.FX.init(game);
    GAME.Render.init(canvas, game);
    GAME.UI.init(game);
    GAME.Input.attach(canvas, game);

    let audioOn = false;
    function wakeAudio() {
      if (audioOn) return;
      audioOn = true;
      try { GAME.Audio.init(); } catch (err) { console.error('[main] Audio.init 失败', err); }
    }
    window.addEventListener('pointerdown', wakeAudio);
    window.addEventListener('keydown', wakeAudio);

    window.game = game; // 调试 / QA 无头挂钩

    const STEP = 1 / 60;   // 固定步进 60Hz
    const MAX_DT = 0.05;   // dt 上限：防后台切回时一帧跳变
    let last = performance.now();
    let acc = 0;

    // 排空 game.events，逐个分发给 FX / Audio / UI
    function dispatchEvents() {
      if (!game.events.length) return;
      const evs = game.events.splice(0, game.events.length);
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        try { GAME.FX.handleEvent(e); } catch (err) { console.error('[main] FX.handleEvent', err); }
        try { GAME.Audio.handleEvent(e); } catch (err) { console.error('[main] Audio.handleEvent', err); }
        try { GAME.UI.handleEvent(e); } catch (err) { console.error('[main] UI.handleEvent', err); }
      }
    }

    function frame(now) {
      requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0;
      if (dt > MAX_DT) dt = MAX_DT;
      acc += dt;
      // 固定步进：一帧最多补 3 步（dt 已被钳到 0.05）
      while (acc >= STEP) {
        game.update(STEP);
        acc -= STEP;
      }
      dispatchEvents();
      try { GAME.FX.update(dt); } catch (err) { console.error('[main] FX.update', err); }
      try { GAME.Render.draw(); } catch (err) { console.error('[main] Render.draw', err); }
      try { GAME.UI.update(); } catch (err) { console.error('[main] UI.update', err); }
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

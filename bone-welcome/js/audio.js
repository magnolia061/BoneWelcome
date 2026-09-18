// =============================================================
// 白骨迎宾道 · audio.js —— WebAudio 合成音效（无外部音频文件）
// API: GAME.Audio.init() / handleEvent(e) / setEnabled(bool) → bool
// init 在首次用户手势时调用；调用前一切方法为空操作安全。
// =============================================================
(function (root) {
  'use strict';
  root.GAME = root.GAME || {};

  let ctx = null;        // AudioContext（首次用户手势才创建）
  let master = null;     // 主增益
  let noiseBuf = null;   // 共享噪声 buffer
  let enabled = true;    // 默认开
  const lastPlay = {};   // 同帧同类事件合并：key → ctx.currentTime

  const MASTER_GAIN = 0.16; // 音量克制

  // ---- 基础件 ----
  function makeNoise() {
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // 同 key 在 minGap 秒内只响一次（防止一帧多事件炸耳）
  function gate(key, minGap) {
    if (!ctx) return false;
    const now = ctx.currentTime;
    if (lastPlay[key] !== undefined && now - lastPlay[key] < (minGap || 0.07)) return false;
    lastPlay[key] = now;
    return true;
  }

  // 振荡器单音：type 波形, f0→f1 频率滑移, dur 时长, vol 音量, delay 延迟
  function tone(type, f0, f1, dur, vol, delay) {
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // 噪声：dur 时长, vol 音量, filterType/f0→f1 滤波, delay 延迟
  function noise(dur, vol, filterType, f0, f1, delay, q) {
    const t0 = ctx.currentTime + (delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType || 'lowpass';
    flt.frequency.setValueAtTime(f0 || 800, t0);
    if (f1 && f1 !== f0) flt.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t0 + dur);
    flt.Q.value = q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // ---- 具名音效 ----
  const SFX = {
    shoot()      { tone('triangle', 1400, 500, 0.08, 0.35); },                    // 射箭 biu
    thud()       { noise(0.09, 0.5, 'lowpass', 500, 150);                         // 命中 thud
                   tone('sine', 110, 60, 0.08, 0.3); },
    collapse()   { noise(0.55, 0.7, 'lowpass', 260, 60);                          // 塔毁/破墙崩塌
                   tone('sine', 70, 35, 0.5, 0.45); },
    wail()       { tone('sine', 620, 280, 0.7, 0.22);                             // 恐惧下行失谐呜咽
                   tone('sine', 631, 292, 0.7, 0.22); },
    chime()      { tone('sine', 660, 660, 0.35, 0.3, 0);                          // 封印上行三音风铃
                   tone('sine', 830, 830, 0.4, 0.3, 0.12);
                   tone('sine', 990, 990, 0.55, 0.32, 0.24); },
    dig()        { tone('triangle', 120, 70, 0.12, 0.5, 0);                       // 挖掘咚咚
                   tone('triangle', 110, 65, 0.14, 0.5, 0.16); },
    crackle()    { for (let i = 0; i < 3; i++)                                    // 伏击碎裂
                     noise(0.05, 0.4, 'highpass', 1800, 900, i * 0.06, 2); },
    win()        { const n = [523, 659, 784, 1047];                               // 胜利上行琶音
                   for (let i = 0; i < n.length; i++) tone('triangle', n[i], n[i], 0.4, 0.35, i * 0.13); },
    lose()       { const n = [392, 330, 262, 196];                                // 失败下行阴沉
                   for (let i = 0; i < n.length; i++) tone('sine', n[i], n[i] * 0.94, 0.55, 0.32, i * 0.18); },
    click()      { tone('square', 900, 700, 0.04, 0.18); },                       // 出兵 click
    boom()       { noise(0.4, 0.55, 'lowpass', 320, 70);                          // 领主技能低鸣
                   tone('sine', 90, 45, 0.4, 0.4); },
    rise()       { tone('sine', 300, 520, 0.18, 0.15); },                         // 骷髅爬出微响
  };

  // =============================================================
  // 事件分发（合同事件清单之外的忽略）
  // =============================================================
  function handleEvent(e) {
    if (!ctx || !enabled || !e || !e.type) return;
    switch (e.type) {
      case 'hit':
        if (gate('hit')) {
          if (e.kind === 'unit' || e.kind === 'skel') SFX.shoot(); // 箭矢命中的 biu+thud
          SFX.thud();
        }
        break;
      case 'tower-down':   if (gate('collapse')) SFX.collapse(); break;
      case 'wall-break':   if (gate('collapse')) SFX.collapse(); break;
      case 'gate-down':    if (gate('collapse')) SFX.collapse(); break;
      case 'unit-die':     if (gate('die', 0.1)) noise(0.12, 0.35, 'lowpass', 700, 200); break;
      case 'skeleton-die': if (gate('die', 0.1)) noise(0.12, 0.3, 'bandpass', 900, 300, 0, 1.5); break;
      case 'skeleton-rise':if (gate('rise', 0.15)) SFX.rise(); break;
      case 'fear':         if (gate('fear', 0.3)) SFX.wail(); break;
      case 'seal-done':    SFX.chime(); break;
      case 'dig-done':     SFX.dig(); break;
      case 'ambush':       if (gate('ambush')) SFX.crackle(); break;
      case 'lord-ability': SFX.boom(); break;
      case 'unit-spawn':   if (gate('spawn', 0.05)) SFX.click(); break;
      case 'win':          SFX.win(); break;
      case 'lose':         SFX.lose(); break;
      default: break; // tutorial / cmd-denied / soul-change / dig-start / seal-start 静音
    }
  }

  function init() {
    if (ctx) { // 重复手势时确保 resume（浏览器自动暂停策略）
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? MASTER_GAIN : 0;
    master.connect(ctx.destination);
    noiseBuf = makeNoise();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (master) master.gain.value = enabled ? MASTER_GAIN : 0;
    return enabled;
  }

  root.GAME.Audio = { init, handleEvent, setEnabled };
})(typeof window !== 'undefined' ? window : globalThis);

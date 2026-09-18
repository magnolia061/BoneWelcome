// =============================================================
// 白骨迎宾道 · test/redline-probe.js —— 红线调节探针（临时工具）
// 目的：骷髅改守卫 AI 后剧本 A（无脑 Rush）红线失守，
// 用证据告诉制作人哪个 config 旋钮能把它救回来。
// 原理：猴子补丁 fs.readFileSync，仅在【内存中】把
//   guardRadius: 5 → guardRadius: N（命令行参数，默认 8），
// 然后原样跑 QA 的 playtest.js。磁盘上的 config.js 绝不动。
// 副作用：test/playtest-results.json 会被本探针的调参结果覆盖，
//   跑完后应再跑一次 node test/playtest.js 恢复正式归档。
// 运行：node test/redline-probe.js [guardRadius]
// =============================================================
const fs = require('fs');
const radius = process.argv[2] || '8';
const orig = fs.readFileSync;
fs.readFileSync = function (p) {
  const src = orig.apply(fs, arguments);
  if (typeof src === 'string' && String(p).replace(/\\/g, '/').endsWith('js/config.js')) {
    console.log('[redline-probe] 内存中注入 guardRadius: ' + radius + '（磁盘 config.js 未改）');
    return src.replace('guardRadius: 5', 'guardRadius: ' + radius);
  }
  return src;
};
require('./playtest.js');

/* ============ 森林图（元分析合并效应：证据综合的招牌图） ============ */
/* 逆方差权重 + DerSimonian-Laird 随机效应 + Q / I² 异质性检验 */

import { el, text, INK, colors } from '../core/svg.js?v=20261114b';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114b';
import { niceTicks, linear } from '../core/scale.js?v=20261114b';
import { tip, tipHide } from '../core/tip.js?v=20261114b';

/*
 * data = {
 *   studies: [ { name:'Li 2019', effect: .42, se: .14 } ],  // effect=SMD/logRR 等
 *   x: { label:'标准化均差 SMD' }
 * }
 * o = { nullAt:0 }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const ST = data.studies, cs = colors();
  const footH = 42;                                // 底部统计行 + 轴标签 + 图注

  /* ---- 逆方差元分析（固定 + DL 随机） ---- */
  const w = ST.map(s => 1 / (s.se * s.se));
  const sw = w.reduce((a, b) => a + b, 0);
  const muF = ST.reduce((a, s, i) => a + w[i] * s.effect, 0) / sw;
  const Q = ST.reduce((a, s, i) => a + w[i] * (s.effect - muF) ** 2, 0);
  const df = ST.length - 1;
  const I2 = Math.max(0, (Q - df) / (Q || 1)) * 100;
  const tau2 = Math.max(0, (Q - df) / (sw - w.reduce((a, b) => a + b * b, 0) / sw));
  const wr = ST.map((s, i) => 1 / (s.se * s.se + tau2));
  const swr = wr.reduce((a, b) => a + b, 0);
  const mu = swr ? ST.reduce((a, s, i) => a + wr[i] * s.effect, 0) / swr : muF;
  const muSe = Math.sqrt(1 / (swr || sw));
  const z95 = 1.959964;
  const pooled = { lo: mu - z95 * muSe, hi: mu + z95 * muSe };

  /* ---- 布局 ---- */
  const colL = 34, colR = 30;                      // 左：研究名 右：效应[CI]
  const box = { x: colL + 2, y: top + 11, w: W - colL - colR - 8, h: H - top - footH - 14 };
  const bounds = ST.flatMap(s => [s.effect - z95 * s.se, s.effect + z95 * s.se])
    .concat([pooled.lo, pooled.hi, o.nullAt ?? 0]);
  const X = niceTicks(Math.min(...bounds), Math.max(...bounds), 5);
  const val = linear(X.lo, X.hi, box.x, box.x + box.w);
  const k = ST.length;
  const rowH = Math.min(7, (box.h - 4) / (k + 1.6));
  const yOf = i => box.y + box.h - 2 - (k - i) * rowH;   // 研究从上到下，底部留合并行
  const yPool = box.y + box.h - 2;

  /* ---- 轴 ---- */
  for (const t of X.ticks) {
    el('line', { x1: val(t), x2: val(t), y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .2 }, svg);
    el('line', { x1: val(t), x2: val(t), y1: yOf(k - 1) - rowH * .4, y2: yOf(k - 1) - rowH * .4 + 1.2, stroke: INK.axis, 'stroke-width': .3 }, svg);
    text(svg, val(t), box.y + box.h + 3.6, fmt(t), { size: 2.4, anchor: 'middle', fill: INK.soft });
  }
  el('line', { x1: box.x, x2: box.x + box.w, y1: box.y + box.h, y2: box.y + box.h, stroke: INK.axis, 'stroke-width': .35 }, svg);
  if (data.x?.label) text(svg, box.x + box.w / 2, box.y + box.h + 7.4, data.x.label, { size: 2.8, anchor: 'middle' });

  /* 无效线 + 合并效应线 */
  const xNull = val(o.nullAt ?? 0);
  if (xNull >= box.x && xNull <= box.x + box.w)
    el('line', { x1: xNull, x2: xNull, y1: box.y - 1, y2: yPool, stroke: INK.soft, 'stroke-width': .3, 'stroke-dasharray': '1.4 1.1' }, svg);
  el('line', { x1: val(mu), x2: val(mu), y1: box.y - 1, y2: yPool, stroke: cs[0], 'stroke-width': .3, 'stroke-dasharray': '.7 1.1', 'stroke-opacity': .8 }, svg);
  text(svg, box.x + box.w, box.y - 2.6, `合并 ${fmt(+mu.toFixed(2))}（${I2 >= 50 ? 'RE' : 'FE'}）`, { size: 2.2, anchor: 'end', fill: INK.soft });

  /* ---- 各研究：方块 ∝ 权重 + CI ---- */
  const wMax = Math.max(...(I2 >= 50 ? wr : w));
  ST.forEach((s, i) => {
    const y = yOf(i);
    const eff = s.effect, lo = eff - z95 * s.se, hi = eff + z95 * s.se;
    const wi = (I2 >= 50 ? wr : w)[i];
    const side = Math.max(1.3, Math.min(5, Math.sqrt(wi / wMax) * 5));
    text(svg, colL, y + .9, s.name, { size: 2.4, anchor: 'end', fill: INK.base });
    const ln = el('line', { x1: val(lo), x2: val(hi), y1: y, y2: y, stroke: INK.base, 'stroke-width': .35 }, svg);
    el('line', { x1: val(lo), x2: val(lo), y1: y - 1, y2: y + 1, stroke: INK.base, 'stroke-width': .35 }, svg);
    el('line', { x1: val(hi), x2: val(hi), y1: y - 1, y2: y + 1, stroke: INK.base, 'stroke-width': .35 }, svg);
    const sq = el('rect', { x: val(eff) - side / 2, y: y - side / 2, width: side, height: side, fill: cs[0], 'fill-opacity': .85, cursor: 'pointer' }, svg);
    text(svg, W - colR + 4, y + .9, `${fmt(+eff.toFixed(2))} [${fmt(+lo.toFixed(2))}, ${fmt(+hi.toFixed(2))}]`, { size: 2.2, anchor: 'start', fill: INK.soft });
    const wPct = (wi / (I2 >= 50 ? swr : sw) * 100).toFixed(1);
    const msg = `<b>${s.name}</b><br>效应 ${fmt(+eff.toFixed(3))} · 95% CI [${fmt(+lo.toFixed(3))}, ${fmt(+hi.toFixed(3))}]<br>权重 ${wPct}%${i === 0 ? '' : ''}`;
    [sq, ln].forEach(n => {
      n.addEventListener('pointerenter', ev => tip(msg, ev));
      n.addEventListener('pointermove', ev => tip(msg, ev));
      n.addEventListener('pointerleave', tipHide);
    });
  });

  /* ---- 合并效应：菱形 ---- */
  const dmx = val(mu), dy = yPool, dx = Math.max(1.4, (val(pooled.hi) - val(pooled.lo)) / 2);
  const dm = `M${dmx} ${dy - rowH * .34}L${dmx + dx} ${dy}L${dmx} ${dy + rowH * .34}L${dmx - dx} ${dy}Z`;
  const dp = el('path', { d: dm, fill: cs[0], 'fill-opacity': .9, stroke: 'none', cursor: 'pointer' }, svg);
  text(svg, colL, dy + .9, `合并效应（${I2 >= 50 ? '随机' : '固定'}）`, { size: 2.4, anchor: 'end', fill: INK.base });
  text(svg, W - colR + 4, dy + .9, `${fmt(+mu.toFixed(2))} [${fmt(+pooled.lo.toFixed(2))}, ${fmt(+pooled.hi.toFixed(2))}]`, { size: 2.2, anchor: 'start', fill: INK.base });
  const pMsg = `<b>合并效应（${I2 >= 50 ? '随机效应 · DL' : '固定效应 · IV'}）</b><br>${fmt(+mu.toFixed(3))} · 95% CI [${fmt(+pooled.lo.toFixed(3))}, ${fmt(+pooled.hi.toFixed(3))}]<br>异质性 Q=${Q.toFixed(1)}（df=${df}）· I²=${I2.toFixed(0)}%`;
  dp.addEventListener('pointerenter', ev => tip(pMsg, ev));
  dp.addEventListener('pointermove', ev => tip(pMsg, ev));
  dp.addEventListener('pointerleave', tipHide);

  /* ---- 异质性统计行（在轴标签与 x 轴名之下，单独一行） ---- */
  text(svg, box.x, box.y + box.h + 11.2, `Q = ${Q.toFixed(1)}，df = ${df}，I² = ${I2.toFixed(0)}%，τ² = ${tau2.toFixed(3)}（${I2 >= 50 ? '随机效应模型' : '固定效应模型'}）`, { size: 2.2, fill: INK.soft });

  figureNote(svg, o);
  return svg;
}

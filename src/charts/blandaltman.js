/* ============ Bland-Altman 图（两种测量的一致性：Tukey 均值-差图） ============ */
/* Bland & Altman 1986, The Lancet —— 方法学比对/评分员信度的标准图 */

import { el, text, INK, colors } from '../core/svg.js?v=20261114a';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114a';
import { niceTicks, linear } from '../core/scale.js?v=20261114a';
import { tip, tipHide } from '../core/tip.js?v=20261114a';

/*
 * data = {
 *   pairs: [ [a, b], ... ],   // 同一对象两种测量
 *   x: { label:'两法均值 / 分' }, y: { label:'两法差值 b − a / 分' }
 * }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const P = data.pairs, cs = colors();
  const footH = 26;

  const M = P.map(p => (p[0] + p[1]) / 2);
  const D = P.map(p => p[1] - p[0]);
  const n = P.length;
  const mD = D.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(D.reduce((a, b) => a + (b - mD) ** 2, 0) / (n - 1));
  const loa = [mD - 1.96 * sd, mD + 1.96 * sd];

  const X = niceTicks(Math.min(...M), Math.max(...M), 5);
  const Y = niceTicks(Math.min(...D, loa[0]), Math.max(...D, loa[1]), 5);
  const box = { x: 17, y: top + 10, w: W - 24, h: H - top - 10 - footH };
  const valX = linear(X.lo, X.hi, box.x, box.x + box.w);
  const valY = linear(Y.lo, Y.hi, box.y + box.h, box.y);

  /* 轴 + 网格 */
  for (const t of X.ticks) {
    el('line', { x1: valX(t), x2: valX(t), y1: box.y + box.h, y2: box.y + box.h + 1.2 }, svg);
    text(svg, valX(t), box.y + box.h + 3.4, fmt(t), { size: 2.4, anchor: 'middle', fill: INK.soft });
    if (t !== X.lo) el('line', { x1: valX(t), x2: valX(t), y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .2 }, svg);
  }
  for (const t of Y.ticks) {
    el('line', { x1: box.x - 1.2, x2: box.x, y1: valY(t), y2: valY(t) }, svg);
    text(svg, box.x - 2, valY(t) + .9, fmt(t), { size: 2.4, anchor: 'end', fill: INK.soft });
    if (t !== Y.lo) el('line', { x1: box.x, x2: box.x + box.w, y1: valY(t), y2: valY(t), stroke: INK.hair, 'stroke-width': .2 }, svg);
  }
  el('path', { d: `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);
  if (data.x?.label) text(svg, box.x + box.w / 2, box.y + box.h + 7.2, data.x.label, { size: 2.8, anchor: 'middle' });
  if (data.y?.label) {
    const t = text(svg, 0, 0, data.y.label, { size: 2.8, anchor: 'middle', fill: INK.base });
    t.setAttribute('transform', `translate(${box.x - 10.5} ${box.y + box.h / 2}) rotate(-90)`);
  }

  /* 散点 */
  P.forEach((p, i) => {
    const c = el('circle', { cx: valX(M[i]).toFixed(2), cy: valY(D[i]).toFixed(2), r: .85, fill: cs[0], 'fill-opacity': .7, cursor: 'pointer' }, svg);
    const msg = `<b>观测 ${i + 1}</b><br>甲 ${fmt(p[0])} · 乙 ${fmt(p[1])}<br>均值 ${fmt(+M[i].toFixed(1))} · 差值 ${D[i] >= 0 ? '+' : ''}${fmt(+D[i].toFixed(2))}`;
    c.addEventListener('pointerenter', ev => tip(msg, ev));
    c.addEventListener('pointermove', ev => tip(msg, ev));
    c.addEventListener('pointerleave', tipHide);
  });

  /* 三条参考线：均值差（实） + 95% LoA（虚） */
  const line = (yv, dash, color, w) => el('line', { x1: box.x, x2: box.x + box.w, y1: valY(yv), y2: valY(yv), stroke: color, 'stroke-width': w, ...(dash ? { 'stroke-dasharray': dash } : {}) }, svg);
  line(mD, null, INK.base, .55);
  line(loa[0], '1.6 1.3', INK.soft, .45);
  line(loa[1], '1.6 1.3', INK.soft, .45);
  const lbl = (yv, str, fill) => text(svg, box.x + box.w - 1, valY(yv) - 1.4, str, {
    size: 2.2, anchor: 'end', fill,
    extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .6 }
  });
  lbl(mD, `均值差 ${fmt(+mD.toFixed(2))}`, INK.base);
  lbl(loa[1], `+1.96 SD = ${fmt(+loa[1].toFixed(2))}`, INK.soft);
  lbl(loa[0], `−1.96 SD = ${fmt(+loa[0].toFixed(2))}`, INK.soft);
  if (0 >= Y.lo && 0 <= Y.hi) el('line', { x1: box.x, x2: box.x + box.w, y1: valY(0), y2: valY(0), stroke: INK.hair, 'stroke-width': .25 }, svg);

  figureNote(svg, o);
  return svg;
}

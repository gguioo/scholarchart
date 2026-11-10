/* ============ ROC 曲线（诊断准确性 + AUC + Youden 最佳切点） ============ */
/* signal detection —— 灵敏度 / 特异度权衡的标准呈现 */

import { el, text, INK, colors } from '../core/svg.js';
import { caption, figureNote, fmt } from '../core/axis.js';
import { linear, mulberry32 } from '../core/scale.js';
import { tip, tipHide } from '../core/tip.js';

/* 秩法 AUC（含并列平均秩） */
function aucRank(pos, neg) {
  const all = pos.map(v => ({ v, g: 1 })).concat(neg.map(v => ({ v, g: 0 }))).sort((a, b) => a.v - b.v);
  let i = 0, r = 0, sumPos = 0;
  while (i < all.length) {
    let j = i; while (j < all.length && all[j].v === all[i].v) j++;
    const avgR = (i + j + 1) / 2;                     // 1-based 平均秩
    for (let k = i; k < j; k++) if (all[k].g) sumPos += avgR;
    i = j;
  }
  const n1 = pos.length, n0 = neg.length;
  return (sumPos - n1 * (n1 + 1) / 2) / (n1 * n0);
}

/*
 * data = { pos:[..], neg:[..] }   // 阳性/阴性组得分（越高越可能阳性）
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const pos = data.pos, neg = data.neg;
  const cs = colors();
  const footH = 26;
  const box = { x: 16, y: top + 8, w: W - 22, h: H - top - 8 - footH };
  const valX = linear(0, 1, box.x, box.x + box.w);   // FPR
  const valY = linear(0, 1, box.y + box.h, box.y);   // TPR

  /* 曲线点：遍历全部阈值（锚点 (0,0) → (1,1)） */
  const cuts = [...new Set(pos.concat(neg))].sort((a, b) => a - b);
  const pts = [{ f: 0, t: 0 }];
  for (const c of cuts) {
    const tp = pos.filter(v => v >= c).length, fp = neg.filter(v => v >= c).length;
    pts.push({ f: fp / neg.length, t: tp / pos.length, c });
  }
  pts.push({ f: 1, t: 1 });
  pts.sort((a, b) => a.f - b.f || a.t - b.t);

  const AUC = aucRank(pos, neg);

  /* bootstrap AUC CI（确定性种子） */
  const rnd = mulberry32(20261110), Bs = 800, boots = [];
  for (let b = 0; b < Bs; b++) {
    const p = [], n = [];
    for (let i = 0; i < pos.length; i++) p.push(pos[(rnd() * pos.length) | 0]);
    for (let i = 0; i < neg.length; i++) n.push(neg[(rnd() * neg.length) | 0]);
    boots.push(aucRank(p, n));
  }
  boots.sort((a, b) => a - b);
  const ci = [boots[Math.floor(Bs * .025)], boots[Math.floor(Bs * .975)]];

  /* Youden J 最佳切点 */
  let best = null;
  for (const p of pts) { const J = p.t - p.f; if (p.c !== undefined && (!best || J > best.J)) best = { ...p, J }; }

  /* 轴（0-1 方形） */
  for (const s of [0, .25, .5, .75, 1]) {
    el('line', { x1: valX(s), x2: valX(s), y1: box.y, y2: box.y + box.h, stroke: s === 0 ? INK.axis : INK.hair, 'stroke-width': .3 }, svg);
    el('line', { x1: box.x, x2: box.x + box.w, y1: valY(s), y2: valY(s), stroke: s === 0 ? INK.axis : INK.hair, 'stroke-width': .3 }, svg);
    text(svg, valX(s), box.y + box.h + 3.4, s.toFixed(2).replace('0.', '.'), { size: 2.3, anchor: 'middle', fill: INK.soft });
    text(svg, box.x - 2, valY(s) + .9, s.toFixed(2).replace('0.', '.'), { size: 2.3, anchor: 'end', fill: INK.soft });
  }
  if (data.x?.label) text(svg, box.x + box.w / 2, box.y + box.h + 7.2, data.x.label || '假阳性率 FPR（1 − 特异度）', { size: 2.8, anchor: 'middle' });
  const yl = text(svg, 0, 0, data.y?.label || '真阳性率 TPR（灵敏度）', { size: 2.8, anchor: 'middle', fill: INK.base });
  yl.setAttribute('transform', `translate(${box.x - 10.5} ${box.y + box.h / 2}) rotate(-90)`);

  /* 机会线 + ROC 折线 */
  el('line', { x1: valX(0), y1: valY(0), x2: valX(1), y2: valY(1), stroke: INK.soft, 'stroke-width': .3, 'stroke-dasharray': '1.6 1.3' }, svg);
  const d = 'M' + pts.map(p => `${valX(p.f).toFixed(2)} ${valY(p.t).toFixed(2)}`).join('L');
  const pth = el('path', { d, fill: 'none', stroke: cs[0], 'stroke-width': .8, cursor: 'pointer' }, svg);
  const msg = `<b>ROC 曲线</b><br>AUC = ${AUC.toFixed(3)} · 95% CI [${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}]<br>n₊ = ${pos.length} · n₋ = ${neg.length}<br>虚线 = 机会线（AUC = .5）`;
  pth.addEventListener('pointerenter', ev => tip(msg, ev));
  pth.addEventListener('pointermove', ev => tip(msg, ev));
  pth.addEventListener('pointerleave', tipHide);

  /* Youden 点 */
  if (best) {
    const bp = el('circle', { cx: valX(best.f), cy: valY(best.t), r: 1.1, fill: cs[3], cursor: 'pointer' }, svg);
    const bmsg = `<b>Youden J 最佳切点</b><br>切点 = ${fmt(+best.c.toFixed(2))}<br>灵敏度 ${best.t.toFixed(2)} · 特异度 ${(1 - best.f).toFixed(2)}<br>J = ${best.J.toFixed(2)}`;
    bp.addEventListener('pointerenter', ev => tip(bmsg, ev));
    bp.addEventListener('pointermove', ev => tip(bmsg, ev));
    bp.addEventListener('pointerleave', tipHide);
  }

  /* AUC 角标（右下空白区，远离曲线与对角线） */
  text(svg, box.x + box.w - 3, box.y + box.h - 8.6, `AUC = ${AUC.toFixed(2)} [${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}]`, {
    size: 2.6, anchor: 'end', fill: INK.base,
    extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .7 }
  });
  if (best) text(svg, box.x + box.w - 3, box.y + box.h - 4.8, `最佳切点 ${fmt(+best.c.toFixed(2))}（J = ${best.J.toFixed(2)}）`, { size: 2.3, anchor: 'end', fill: INK.soft });

  figureNote(svg, o);
  return svg;
}

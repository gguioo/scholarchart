/* ============ Q-Q 图（分布正态性检查：样本分位数 vs 理论分位数） ============ */
/* 检查分布假设的第一图 —— 点贴线 = 正态 */

import { el, text, INK, colors } from '../core/svg.js?v=20261111h';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261111h';
import { niceTicks, linear } from '../core/scale.js?v=20261111h';
import { tip, tipHide } from '../core/tip.js?v=20261111h';

/* 标准正态分位数函数 Φ⁻¹（A&S 26.2.23，|ε| < 4.5e-4，画图足够） */
const qnorm = p => {
  const u = p <= .5 ? p : 1 - p;                      // 尾侧概率
  if (u <= 0) return p < .5 ? -Infinity : Infinity;
  const t = Math.sqrt(-2 * Math.log(u));
  const num = 2.515517 + .802853 * t + .010328 * t * t;
  const den = 1 + 1.432788 * t + .189269 * t * t + .001308 * t * t * t;
  const z = t - num / den;
  return p < .5 ? -z : z;
};

/*
 * data = { values: [..] }   // 单变量样本
 * o = {}
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const V = [...data.values].sort((a, b) => a - b);
  const n = V.length, cs = colors();
  const footH = 26;
  const box = { x: 16, y: top + 8, w: W - 22, h: H - top - 8 - footH };

  /* 理论分位数（Blom 偏差校正 ppoints） */
  const th = V.map((_, i) => qnorm((i + .375) / (n + .25)));

  /* 四分位数参考线（R qqline 法） */
  const q = p => V[Math.min(n - 1, Math.max(0, p * (n - 1)))];
  const interp = p => { const x = p * (n - 1), k = Math.floor(x), f = x - k; return V[k] + f * (V[Math.min(n - 1, k + 1)] - V[k]); };
  const dq1 = interp(.25), dq3 = interp(.75), tq1 = qnorm(.25), tq3 = qnorm(.75);
  const slope = (dq3 - dq1) / (tq3 - tq1), icept = dq1 - slope * tq1;
  const mean = V.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(V.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const r = (() => {                                 // 拟合相关（正态性度量）
    const mt = th.reduce((a, b) => a + b, 0) / n, mv = V.reduce((a, b) => a + b, 0) / n;
    let st = 0, sv = 0, sxy = 0;
    V.forEach((v, i) => { st += (th[i] - mt) ** 2; sv += (v - mv) ** 2; sxy += (th[i] - mt) * (v - mv); });
    return st && sv ? sxy / Math.sqrt(st * sv) : 0;
  })();

  /* 轴（边点留出整圆空间） */
  const padT = (th[n - 1] - th[0]) * .045 + .001;
  const TX = niceTicks(th[0] - padT, th[n - 1] + padT, 5), TY = niceTicks(V[0], V[n - 1], 5);
  const valX = linear(TX.lo, TX.hi, box.x, box.x + box.w);
  const valY = linear(TY.lo, TY.hi, box.y + box.h, box.y);
  for (const t of TX.ticks) {
    el('line', { x1: valX(t), x2: valX(t), y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .2 }, svg);
    text(svg, valX(t), box.y + box.h + 3.4, fmt(+t.toFixed(2)), { size: 2.3, anchor: 'middle', fill: INK.soft });
  }
  for (const t of TY.ticks) {
    el('line', { x1: box.x, x2: box.x + box.w, y1: valY(t), y2: valY(t), stroke: INK.hair, 'stroke-width': .2 }, svg);
    text(svg, box.x - 2, valY(t) + .9, fmt(t), { size: 2.3, anchor: 'end', fill: INK.soft });
  }
  el('path', { d: `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);
  text(svg, box.x + box.w / 2, box.y + box.h + 7.2, '理论正态分位数', { size: 2.8, anchor: 'middle' });
  const yl = text(svg, 0, 0, data.y?.label || '样本分位数', { size: 2.8, anchor: 'middle', fill: INK.base });
  yl.setAttribute('transform', `translate(${box.x - 10.5} ${box.y + box.h / 2}) rotate(-90)`);

  /* 参考线 */
  const lx0 = TX.lo, lx1 = TX.hi;
  el('line', { x1: valX(lx0), y1: valY(icept + slope * lx0), x2: valX(lx1), y2: valY(icept + slope * lx1), stroke: INK.soft, 'stroke-width': .5, 'stroke-dasharray': '1.6 1.3' }, svg);

  /* 样本点 */
  V.forEach((v, i) => {
    const c = el('circle', { cx: valX(th[i]).toFixed(2), cy: valY(v).toFixed(2), r: .68, fill: cs[0], 'fill-opacity': .65, cursor: 'pointer' }, svg);
    const msg = `<b>样本第 ${(i + 1)} / ${n} 位</b><br>样本值 ${fmt(v)} · 理论 z = ${th[i].toFixed(2)}<br>参考线预测 ${fmt(+(icept + slope * th[i]).toFixed(1))} · 残差 ${fmt(+((v - icept - slope * th[i]) / (sd || 1)).toFixed(2))} SD`;
    c.addEventListener('pointerenter', ev => tip(msg, ev));
    c.addEventListener('pointermove', ev => tip(msg, ev));
    c.addEventListener('pointerleave', tipHide);
  });

  /* 角标 */
  text(svg, box.x + 3, box.y + 4.5, `n = ${n} · r = ${n > 1 ? r.toFixed(3) : '—'} · μ = ${fmt(+mean.toFixed(1))} · σ = ${n > 1 ? fmt(+sd.toFixed(1)) : '—'}`, {
    size: 2.4, fill: INK.base,
    extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .7 }
  });
  text(svg, box.x + 3, box.y + 8.2, 'r > .99 ≈ 正态；点贴线为正态', { size: 2.2, fill: INK.soft });

  figureNote(svg, o);
  return svg;
}

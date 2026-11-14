/* ============ 时间序列分解（观测 = 趋势 + 季节 + 残差，经典分解） ============ */
/* 四联面板：趋势漂移、季节模式、残差白噪——时间序列的第一诊断图 */

import { el, text, INK, colors } from '../core/svg.js?v=20261114f';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114f';
import { niceTicks, linear, smoothPath } from '../core/scale.js?v=20261114f';
import { tip, tipHide } from '../core/tip.js?v=20261114f';

/*
 * data = { t: [0..n-1 序号或年月数值], values: [..], period: 12 }
 * o = {}
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const y = data.values, n = y.length, P = data.period || 12;
  const t = data.t ?? y.map((_, i) => i);
  const cs = colors();
  const footH = 26;

  /* 趋势：居中滑动平均（偶周期用 2×P−1 加权窗，端点缩窗） */
  const trend = y.map((_, i) => {
    const half = P / 2;
    let lo = i - half, hi = i + half;
    if (lo < 0) { hi -= lo; lo = 0; }
    if (hi > n - 1) { lo -= (hi - (n - 1)); hi = n - 1; if (lo < 0) lo = 0; }
    let s = 0, w = 0;
    for (let k = lo; k <= hi; k++) {
      let wt = 1;
      if (k === lo && lo === i - half && hi - lo + 1 === P + 1) wt = .5;    // 偶窗端点半权
      if (k === hi && hi === i + half && hi - lo + 1 === P + 1) wt = .5;
      s += y[k] * wt; w += wt;
    }
    return s / w;
  });

  /* 季节：去趋势后按相位均值 + 居中 */
  const detr = y.map((v, i) => v - trend[i]);
  const seas = Array.from({ length: P }, (_, p) => {
    const ds = detr.filter((_, i) => i % P === p);
    return ds.reduce((a, b) => a + b, 0) / (ds.length || 1);
  });
  const seasMean = seas.reduce((a, b) => a + b, 0) / P;
  const seasonal = y.map((_, i) => seas[i % P] - seasMean);
  const remainder = y.map((v, i) => v - trend[i] - seasonal[i]);

  /* 四联面板布局 */
  const avail = H - top - footH;
  const panels = [
    { name: '观测', arr: y, zero: false },
    { name: '趋势', arr: trend, zero: false },
    { name: '季节', arr: seasonal, zero: true },
    { name: '残差', arr: remainder, zero: true }
  ];
  const gap = 5.2, ph = (avail - 10 - gap * 3) / 4;
  const boxX = 16, boxW = W - 22;

  /* 共享 x 轴 */
  const TX = niceTicks(t[0], t[n - 1], 6);
  const valT = linear(TX.lo, TX.hi, boxX, boxX + boxW);

  panels.forEach((pn, pi) => {
    const py = top + 10 + pi * (ph + gap);
    const arr = pn.arr;
    const lo = Math.min(...arr), hi = Math.max(...arr);
    const pad = (hi - lo) * .08 || 1;
    const Y = niceTicks(lo - pad, hi + pad, 3);
    const valY = linear(Y.lo, Y.hi, py + ph, py);
    /* 面板框 + y 刻度（每面只 3 个，字号小） */
    el('rect', { x: boxX, y: py, width: boxW, height: ph, fill: 'none', stroke: INK.axis, 'stroke-width': .25 }, svg);
    for (const yt of Y.ticks) {
      if (pi < 3) text(svg, boxX - 2, valY(yt) + .9, fmt(yt), { size: 2, anchor: 'end', fill: INK.soft });
      else text(svg, boxX - 2, valY(yt) + .9, fmt(yt), { size: 2, anchor: 'end', fill: INK.soft });
    }
    if (pn.zero) el('line', { x1: boxX, x2: boxX + boxW, y1: valY(0), y2: valY(0), stroke: INK.hair, 'stroke-width': .3 }, svg);
    /* 曲线（观测/趋势平滑，季节/残差直线） */
    const pts = arr.map((v, i) => [valT(t[i]), valY(v)]);
    const d = (pi === 0 || pi === 1 ? smoothPath(pts) : 'M' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L'));
    const color = pi === 0 ? INK.base : pi === 1 ? cs[0] : pi === 2 ? cs[2] : cs[4];
    const pth = el('path', { d, fill: 'none', stroke: color, 'stroke-width': pi === 3 ? .35 : .6, cursor: 'pointer' }, svg);
    const msg = `<b>${pn.name}分量</b><br>范围 ${fmt(+Math.min(...arr).toFixed(1))} ~ ${fmt(+Math.max(...arr).toFixed(1))}${pi === 3 ? `<br>残差 σ = ${fmt(+Math.sqrt(remainder.reduce((a, b) => a + b * b, 0) / n).toFixed(1))}` : ''}<br>点击曲线查看；x = ${data.x?.label || '时间'}`;
    pth.addEventListener('pointerenter', ev => tip(msg, ev));
    pth.addEventListener('pointermove', ev => tip(msg, ev));
    pth.addEventListener('pointerleave', tipHide);
    /* 面板名（右缘） */
    text(svg, boxX + boxW - 2.8, py + 3.2, pn.name, {
      size: 2.3, anchor: 'end', fill: color,
      extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .6 }
    });
  });

  /* x 轴刻度（最底面板下方） */
  const lastY = top + 10 + 3 * (ph + gap) + ph;
  for (const tt of TX.ticks) {
    el('line', { x1: valT(tt), x2: valT(tt), y1: lastY, y2: lastY + 1.2, stroke: INK.axis, 'stroke-width': .3 }, svg);
    text(svg, valT(tt), lastY + 3.4, data.tLabel ? data.tLabel[TX.ticks.indexOf(tt)] || fmt(tt) : fmt(tt), { size: 2.3, anchor: 'middle', fill: INK.soft });
  }
  text(svg, boxX + boxW / 2, lastY + 7, data.x?.label || '时间', { size: 2.8, anchor: 'middle' });

  const yl = text(svg, 0, 0, data.y?.label || '数值', { size: 2.8, anchor: 'middle', fill: INK.base });
  yl.setAttribute('transform', `translate(${boxX - 11} ${top + 10 + (avail - 10) / 2}) rotate(-90)`);

  figureNote(svg, o);
  return svg;
}

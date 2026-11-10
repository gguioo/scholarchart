/* ============ 雨云图（半小提琴 + 箱线 + 原始散点：新一代柱状图替身） ============ */
/* Allen et al. 2019, Raincloud plots: a multi-platform tool... */

import { el, text, INK, colors } from '../core/svg.js?v=20261111c';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261111c';
import { niceTicks, linear } from '../core/scale.js?v=20261111c';
import { tip, tipHide } from '../core/tip.js?v=20261111c';

/*
 * data = {
 *   groups: [ { name:'庄子', values:[..原始数据..] } ],
 *   y: { label:'年发文量 / 篇' }
 * }
 * o = { violins:true, points:true, boxes:true }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const G = data.groups;
  const cs = colors();
  const footH = o.note || o.figLabel ? 30 : 18;

  const all = G.flatMap(g => g.values);
  const Y = niceTicks(Math.min(...all, 0), Math.max(...all) * 1.04 + .001, 5);

  const box = { x: 17, y: top + 9, w: W - 26, h: H - top - footH };
  const val = linear(Y.lo, Y.hi, box.y + box.h, box.y);
  const catStep = box.w / G.length;

  /* 轴：左 + 下 */
  const tk = el('g', { stroke: INK.axis, 'stroke-width': .3 }, svg);
  for (const t of Y.ticks) {
    el('line', { x1: box.x, x2: box.x + 1.2, y1: val(t), y2: val(t) }, tk);
    text(svg, box.x - 1.6, val(t) + .85, fmt(t), { size: 2.5, anchor: 'end', fill: INK.soft });
    if (t !== Y.lo) el('line', { x1: box.x, x2: box.x + box.w, y1: val(t), y2: val(t), stroke: INK.hair, 'stroke-width': .2 }, svg);
  }
  el('path', { d: `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);
  if (data.y?.label) {
    const t = text(svg, 0, 0, data.y.label, { size: 2.9, anchor: 'middle' });
    t.setAttribute('transform', `translate(${box.x - 8.5} ${box.y + box.h / 2}) rotate(-90)`);
  }

  G.forEach((g, i) => {
    const xi = box.x + (i + .5) * catStep;
    const color = g.color || cs[i % cs.length];
    const vs = [...g.values].sort((a, b) => a - b);
    const n = vs.length;
    const q = p => vs[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))];
    const q1 = q(.25), q2 = q(.5), q3 = q(.75);
    const iqr = q3 - q1 || 1;
    const wLo = Math.max(Y.lo, q1 - 1.5 * iqr), wHi = Math.min(Y.hi, q3 + 1.5 * iqr);
    const mean = vs.reduce((a, b) => a + b, 0) / n;

    const gg = el('g', {}, svg);

    /* ① 左半小提琴：高斯核密度估计 */
    if (o.violins !== false) {
      const sd = Math.sqrt(vs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
      const h = (0.9 * Math.min(sd, iqr / 1.34 || sd) * Math.pow(n, -0.2)) || 1; // Silverman 带宽
      const K = u => Math.exp(-.5 * u * u) / Math.sqrt(2 * Math.PI);
      const N = 56, pts = [];
      let dmax = 1e-9;
      for (let k = 0; k <= N; k++) {
        const t = Y.lo + (Y.hi - Y.lo) * k / N;
        let d = 0;
        for (const v of vs) d += K((t - v) / h);
        d /= n * h;
        pts.push([d, t]); dmax = Math.max(dmax, d);
      }
      const halfW = catStep * .26;
      let dPath = `M${xi} ${val(Y.lo)}`;
      pts.forEach(([d, t]) => { dPath += `L${(xi - Math.min(.5, d / dmax) * halfW).toFixed(2)} ${val(t).toFixed(2)}`; });
      dPath += `L${xi} ${val(Y.hi)}Z`;
      el('path', { d: dPath, fill: color, 'fill-opacity': .3, stroke: color, 'stroke-width': .45 }, gg);
    }

    /* ② 中间窄箱线（须 = 1.5 IQR） */
    if (o.boxes !== false) {
      const bw = catStep * .09, bx = xi;
      const gq = el('g', {}, gg);
      el('line', { x1: bx, x2: bx, y1: val(wHi), y2: val(wLo), stroke: INK.base, 'stroke-width': .35 }, gq);
      el('rect', { x: bx, y: val(q3), width: bw, height: val(q1) - val(q3), fill: '#fff', stroke: INK.base, 'stroke-width': .45 }, gq);
      el('line', { x1: bx, x2: bx + bw, y1: val(q2), y2: val(q2), stroke: color, 'stroke-width': .8 }, gq);
      for (const [yy, x1, x2] of [[val(wHi), bx, bx + bw], [val(wLo), bx, bx + bw]])
        el('line', { x1, x2, y1: yy, y2: yy, stroke: INK.base, 'stroke-width': .35 }, gq);
      /* 离群点 */
      for (const v of vs)
        if (v < wLo || v > wHi)
          el('circle', { cx: bx + bw * .3, cy: val(v), r: .55, fill: 'none', stroke: INK.soft, 'stroke-width': .3 }, gq);
    }

    /* ③ 右侧原始散点（确定性抖动，重渲染不跳） */
    if (o.points !== false) {
      const x0 = xi + catStep * .11, span = catStep * .2;
      vs.forEach((v, k) => {
        const jit = ((k * 2654435761) % 997) / 997 - .5;
        el('circle', { cx: (x0 + .5 * span + jit * span).toFixed(2), cy: val(v).toFixed(2), r: .6, fill: color, 'fill-opacity': .55 }, gg);
      });
    }

    /* 类目标签 */
    text(svg, xi + catStep * .02, box.y + box.h + 3.4, g.name, { size: 2.5, anchor: 'middle', fill: INK.soft });

    const hit = el('rect', { x: xi - catStep / 2, y: box.y, width: catStep, height: box.h, fill: 'transparent' }, gg);
    hit.addEventListener('pointerenter', ev => tip(`<b>${g.name}</b><br>n = ${n} · 中位数 ${fmt(q2)}<br>均值 ${fmt(+mean.toFixed(1))} · IQR [${fmt(q1)}, ${fmt(q3)}]`, ev));
    hit.addEventListener('pointermove', ev => tip(`<b>${g.name}</b><br>n = ${n} · 中位数 ${fmt(q2)}<br>均值 ${fmt(+mean.toFixed(1))} · IQR [${fmt(q1)}, ${fmt(q3)}]`, ev));
    hit.addEventListener('pointerleave', tipHide);
  });

  figureNote(svg, o);
  return svg;
}

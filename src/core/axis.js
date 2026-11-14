/* ============ 学术坐标系组件 ============ */
/* 只画左+下轴刺（期刊惯例）、向内小刻度、发丝网格；右侧留白 */

import { el, text, INK } from './svg.js?v=20261114e';
import { niceTicks, linear } from './scale.js?v=20261114e';

/*
 * 在 g 容器内建立学术坐标框架
 * opts: { box:{x,y,w,h}, xDomain, yDomain, xLabel, yLabel,
 *         flipX, flipY, grid:'x'|'y'|'xy'|null, xTickN, yTickN }
 * 返回 { x(f), y(f), gx, gy, xTicks, yTicks }
 */
export function axisFrame(g, o) {
  const b = o.box;
  const xt = o.xDomain, yt = o.yDomain;

  const X = niceTicks(xt[0], xt[1], o.xTickN ?? 6);
  const Y = niceTicks(yt[0], yt[1], o.yTickN ?? 5);

  const x = linear(X.lo, X.hi, o.flipX ? b.x + b.w : b.x, o.flipX ? b.x : b.x + b.w);
  const y = linear(Y.lo, Y.hi, o.flipY ? b.y : b.y + b.h, o.flipY ? b.y + b.h : b.y);

  /* 发丝网格（在最底层） */
  const grid = el('g', {}, g);
  if (o.grid?.includes('y')) for (const t of Y.ticks)
    el('line', { x1: b.x, x2: b.x + b.w, y1: y(t), y2: y(t), stroke: INK.hair, 'stroke-width': .2 }, grid);
  if (o.grid?.includes('x')) for (const t of X.ticks)
    el('line', { x1: x(t), x2: x(t), y1: b.y, y2: b.y + b.h, stroke: INK.hair, 'stroke-width': .2 }, grid);

  /* 轴刺：左 + 下，0.3mm 线宽 */
  el('path', {
    d: `M${b.x} ${b.y}V${b.y + b.h}H${b.x + b.w}`,
    fill: 'none', stroke: INK.axis, 'stroke-width': .35
  }, g);

  /* 刻度：向内 1.2mm + 数字标签在外 */
  const tk = el('g', { stroke: INK.axis, 'stroke-width': .3 }, g);
  const lb = el('g', {}, g);
  for (const t of X.ticks) {
    el('line', { x1: x(t), x2: x(t), y1: b.y + b.h, y2: b.y + b.h - 1.2 }, tk);
    if (!o.hideXTicks) text(lb, x(t), b.y + b.h + 3.2, fmt(t), { size: 2.5, anchor: 'middle', fill: INK.soft });
  }
  for (const t of Y.ticks) {
    el('line', { x1: b.x, x2: b.x + 1.2, y1: y(t), y2: y(t) }, tk);
    text(lb, b.x - 1.6, y(t) + .85, fmt(t), { size: 2.5, anchor: 'end', fill: INK.soft });
  }

  /* 轴标题 */
  if (o.xLabel) text(g, b.x + b.w / 2, b.y + b.h + 7.5, o.xLabel, { size: 2.9, anchor: 'middle', fill: INK.base });
  if (o.yLabel) {
    const t = text(g, 0, 0, o.yLabel, { size: 2.9, anchor: 'middle', fill: INK.base });
    t.setAttribute('transform', `translate(${b.x - 8.5} ${b.y + b.h / 2}) rotate(-90)`);
  }

  return { x, y, box: b, xTicks: X, yTicks: Y, g };
}

export function fmt(v) {
  if (Math.abs(v) >= 1000) return v.toLocaleString('en-US');
  if (Number.isInteger(v)) return String(v);
  return String(+v.toFixed(2));
}

/* ============ 标题 + 图注（期刊格式：图下注） ============ */
export function caption(svg, o) {
  const W = +svg.getAttribute('width');
  let y = 0;
  if (o.title) { text(svg, W / 2, 5.5, o.title, { size: 3.4, anchor: 'middle' }); y = 5.5; }
  if (o.subtitle) { text(svg, W / 2, y + 4.2, o.subtitle, { size: 2.4, anchor: 'middle', fill: INK.soft }); y += 4.2; }
  return y;
}

/* 图注（底部 "图 1 xxx" 学术格式），返回占用高度 */
export function figureNote(svg, o) {
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  let y = H - 3;
  if (o.note) { text(svg, 2, y, o.note, { size: 2.3, fill: INK.soft }); y -= 4.5; }
  if (o.figLabel) { text(svg, 2, y, o.figLabel + '  ' + (o.figTitle || ''), { size: 2.9, fill: INK.base }); y -= 5; }
  return H - y;
}

/* ============ 图例（无框，右下角或顶部横排） ============ */
export function legend(svg, items, opts = {}) {
  const cs = opts.cs || 1.8; // 色块边长 mm
  const g = el('g', { class: 'sc-legend' }, svg);
  const W = +svg.getAttribute('width');
  if (opts.pos === 'top') {
    let lx = opts.x ?? 2;
    const ly = opts.y ?? 9;
    for (const it of items) {
      drawKey(g, lx, ly, it, cs);
      const t = text(g, lx + cs + 1.5, ly + cs - .2, it.label, { size: 2.5 });
      lx += cs + 1.5 + t.getComputedTextLength() + 5;
    }
  } else {
    let ly = opts.y ?? 8;
    for (const it of items) {
      drawKey(g, W - 30, ly, it, cs);
      text(g, W - 30 + cs + 1.5, ly + cs - .2, it.label, { size: 2.5 });
      ly += cs + 2.6;
    }
  }
  return g;
}
function drawKey(g, x, y, it, cs) {
  if (it.type === 'line') el('line', { x1: x, x2: x + cs, y1: y + cs / 2, y2: y + cs / 2, stroke: it.color, 'stroke-width': .7, ...(it.dash ? { 'stroke-dasharray': it.dash } : {}) }, g);
  else el('rect', { x, y, width: cs, height: cs, fill: it.color, rx: 0 }, g);
}

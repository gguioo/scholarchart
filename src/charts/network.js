/* ============ 关联网络图（力导向 · 可拖拽 · 淡雅分组色） ============ */

import { el, text, INK, colors } from '../core/svg.js';
import { caption, figureNote } from '../core/axis.js';
import { tip, tipHide } from '../core/tip.js';

/*
 * data = {
 *   nodes: [ { id:'庄子', group:0, size: 12 } ],
 *   edges: [ { a:'庄子', b:'万物论', w: 3 } ]
 * }
 * o = { drag, labels:true, charge, linkDist }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const footH = o.note || o.figLabel ? 24 : 12;
  const cx = W / 2, cy = top + (H - top - footH) / 2;
  const cs = colors();

  const N = data.nodes.map(n => ({
    ...n,
    size: n.size ?? 2.2 + Math.min(4, (data.edges.filter(e => e.a === n.id || e.b === n.id).length) * .5),
    x: cx + (Math.random() - .5) * (W * .5),
    y: cy + (Math.random() - .5) * (H - top - footH) * .5,
    vx: 0, vy: 0, fixed: false
  }));
  const byId = Object.fromEntries(N.map(n => [n.id, n]));
  const E = data.edges.map(e => ({ ...e, A: byId[e.a], B: byId[e.b] })).filter(e => e.A && e.B);

  const gE = el('g', {}, svg), gN = el('g', {}, svg), gL = el('g', {}, svg);
  const linkDist = o.linkDist ?? 30;
  const charge = o.charge ?? 560;

  /* 边（宽度随权重） */
  const maxW = Math.max(...E.map(e => e.w || 1), 1);
  E.forEach(e => {
    e.el = el('line', {
      stroke: INK.axis, 'stroke-width': .3 + (e.w || 1) / maxW * 1.1, 'stroke-opacity': .55,
      'stroke-linecap': 'round'
    }, gE);
  });

  /* 节点（淡雅分组色，直角方块与圆点按需；学术默认圆点） */
  N.forEach(n => {
    n.el = el('circle', {
      r: n.size, fill: cs[n.group % cs.length], fillOpacity: .9,
      stroke: '#fff', 'stroke-width': .5, cursor: 'grab'
    }, gN);
    n.lbl = text(gL, 0, 0, n.id, {
      size: Math.max(2.2, n.size * .78), anchor: 'middle', fill: INK.base,
      extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .7, 'stroke-linejoin': 'round' }
    });
    n.lbl.setAttribute('pointer-events', 'none');
  });

  /* 力导向模拟 */
  const sim = d3like(N, E, {
    charge: -charge, linkDist, linkStrength: d => .4 / Math.max(1, (d.w || 1) / 2),
    bounds: { x0: 8, x1: W - 8, y0: top + 8, y1: H - footH - 4 }
  });

  function render() {
    E.forEach(e => {
      e.el.setAttribute('x1', e.A.x); e.el.setAttribute('y1', e.A.y);
      e.el.setAttribute('x2', e.B.x); e.el.setAttribute('y2', e.B.y);
    });
    N.forEach(n => {
      n.el.setAttribute('cx', n.x); n.el.setAttribute('cy', n.y);
      n.lbl.setAttribute('x', n.x); n.lbl.setAttribute('y', n.y + n.size + 2.6);
    });
  }
  sim.onTick(render);
  render();

  /* 交互：拖拽节点、悬浮聚焦邻居 */
  N.forEach(n => {
    const rel = E.filter(e => e.A === n || e.B === n);
    const nbr = new Set(rel.flatMap(e => [e.A, e.B]));
    n.el.addEventListener('pointerenter', ev => {
      N.forEach(m => {
        const dim = !nbr.has(m) && m !== n;
        m.el.setAttribute('fill-opacity', dim ? .18 : 1);
        m.lbl.setAttribute('fill', dim ? INK.hair : INK.base);
      });
      rel.forEach(e => { e.el.setAttribute('stroke', cs[n.group % cs.length]); e.el.setAttribute('stroke-opacity', .9); });
      const deg = rel.length, wsum = rel.reduce((a, e) => a + (e.w || 1), 0);
      tip(`<b>${n.id}</b><br>关联 ${deg} 项 · 总强度 ${wsum}`, ev);
    });
    n.el.addEventListener('pointermove', ev => tip(`<b>${n.id}</b><br>关联 ${rel.length} 项 · 总强度 ${rel.reduce((a, e) => a + (e.w || 1), 0)}`, ev));
    n.el.addEventListener('pointerleave', () => {
      N.forEach(m => { m.el.setAttribute('fill-opacity', .9); m.lbl.setAttribute('fill', INK.base); });
      rel.forEach(e => { e.el.setAttribute('stroke', INK.axis); e.el.setAttribute('stroke-opacity', .55); });
      tipHide();
    });

    if (o.drag !== false) {
      n.el.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        n.fixed = true; n.el.setAttribute('cursor', 'grabbing');
        const move = ev2 => {
          const pt = toSvg(svg, ev2);
          n.x = pt.x; n.y = pt.y; n.vx = n.vy = 0;
          render(); sim.kick();
        };
        const up = () => {
          n.fixed = false; n.el.setAttribute('cursor', 'grab');
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      });
    }
  });

  figureNote(svg, o);
  return { svg, sim, nodes: N };
}

/* 指针坐标 → SVG 用户坐标（mm） */
function toSvg(svg, ev) {
  const r = svg.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * +svg.getAttribute('width'), y: (ev.clientY - r.top) / r.height * +svg.getAttribute('height') };
}

/* 迷你力导向（零依赖自实现：斥力 + 弹簧 + 向心 + 阻尼 + 边界） */
function d3like(N, E, { charge, linkDist, linkStrength, bounds }) {
  let running = true, raf = null;
  const center = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
  function step() {
    if (!running) return;
    for (let i = 0; i < N.length; i++) {
      const a = N[i];
      for (let j = i + 1; j < N.length; j++) {
        const b = N[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d2 = dx * dx + dy * dy || .01;
        if (d2 > 3600) continue;                 // 60mm 截断省算力
        const f = charge / d2;
        const d = Math.sqrt(d2), ux = dx / d, uy = dy / d;
        a.vx -= f * ux; a.vy -= f * uy;
        b.vx += f * ux; b.vy += f * uy;
      }
    }
    for (const e of E) {
      const dx = e.B.x - e.A.x, dy = e.B.y - e.A.y;
      const d = Math.hypot(dx, dy) || .01;
      const f = (d - linkDist) * .06 * (linkStrength ? linkStrength(e) : 1);
      const ux = dx / d, uy = dy / d;
      if (!e.A.fixed) { e.A.vx += f * ux; e.A.vy += f * uy; }
      if (!e.B.fixed) { e.B.vx -= f * ux; e.B.vy -= f * uy; }
    }
    for (const n of N) {
      n.vx += (center.x - n.x) * .0025; n.vy += (center.y - n.y) * .0025;
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx *= .86; n.vy *= .86;
      n.x = Math.min(bounds.x1, Math.max(bounds.x0, n.x + n.vx));
      n.y = Math.min(bounds.y1, Math.max(bounds.y0, n.y + n.vy));
    }
    /* 硬分离：节点/标签实际间距不足时直接推开（防叠字的关键） */
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const a = N[i], b = N[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || .01;
      const need = a.size + b.size + 5.5;
      if (d < need) {
        const push = (need - d) / 2, ux = dx / d, uy = dy / d;
        if (!a.fixed) { a.x -= push * ux; a.y -= push * uy; }
        if (!b.fixed) { b.x += push * ux; b.y += push * uy; }
      }
    }
    onTick && onTick();
    raf = requestAnimationFrame(step);
  }
  let onTick = null;
  setTimeout(() => { running = false; cancelAnimationFrame(raf); }, 3500); // 收敛后停帧省电
  raf = requestAnimationFrame(step);
  return {
    onTick(fn) { onTick = fn; },
    kick() { running = true; clearTimeout(d3like._t); d3like._t = setTimeout(() => { running = false; }, 2000); raf = requestAnimationFrame(step); }
  };
}

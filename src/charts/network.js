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

/* 迷你力导向（零依赖自实现：斥力 + 弹簧 + 向心 + alpha 衰减收敛 + 力/速度上限防爆） */
function d3like(N, E, { charge, linkDist, linkStrength, bounds }) {
  let alpha = 1, running = true, raf = null, stopT = null;
  const center = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
  function step() {
    if (!running) return;
    const a = alpha;
    for (let i = 0; i < N.length; i++) {
      const A = N[i];
      for (let j = i + 1; j < N.length; j++) {
        const B = N[j];
        let dx = B.x - A.x, dy = B.y - A.y;
        let d2 = dx * dx + dy * dy || .01;
        if (d2 > 3600) continue;                 // 60mm 截断省算力
        const f = Math.min(charge / d2, 2.4) * a; // 斥力封顶：近距不再爆炸
        const d = Math.sqrt(d2), ux = dx / d, uy = dy / d;
        A.vx -= f * ux; A.vy -= f * uy;
        B.vx += f * ux; B.vy += f * uy;
      }
    }
    for (const e of E) {
      const dx = e.B.x - e.A.x, dy = e.B.y - e.A.y;
      const d = Math.hypot(dx, dy) || .01;
      const f = (d - linkDist) * .06 * (linkStrength ? linkStrength(e) : 1) * a;
      const ux = dx / d, uy = dy / d;
      if (!e.A.fixed) { e.A.vx += f * ux; e.A.vy += f * uy; }
      if (!e.B.fixed) { e.B.vx -= f * ux; e.B.vy -= f * uy; }
    }
    let energy = 0;
    for (const n of N) {
      n.vx += (center.x - n.x) * .0025 * a; n.vy += (center.y - n.y) * .0025 * a;
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx *= .82; n.vy *= .82;
      n.vx = Math.max(-4, Math.min(4, n.vx));    // 速度封顶
      n.vy = Math.max(-4, Math.min(4, n.vy));
      n.x = Math.min(bounds.x1, Math.max(bounds.x0, n.x + n.vx));
      n.y = Math.min(bounds.y1, Math.max(bounds.y0, n.y + n.vy));
      energy += n.vx * n.vx + n.vy * n.vy;
    }
    /* 硬分离：每帧最多推开 1.2mm，避免瞬时大位移引起抖动 */
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const A = N[i], B = N[j];
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || .01;
      const need = A.size + B.size + 5.5;
      if (d < need) {
        const push = Math.min((need - d) / 2, 1.2), ux = dx / d, uy = dy / d;
        if (!A.fixed) { A.x -= push * ux; A.y -= push * uy; }
        if (!B.fixed) { B.x += push * ux; B.y += push * uy; }
      }
    }
    alpha *= .97;                                 // 能量衰减：约 2.5 秒后趋静
    if (alpha < .03 && energy < 3) { running = false; onTick && onTick(); return; }
    onTick && onTick();
    raf = requestAnimationFrame(step);
  }
  let onTick = null;
  stopT = setTimeout(() => { running = false; cancelAnimationFrame(raf); }, 6000); // 兜底停帧
  raf = requestAnimationFrame(step);
  return {
    onTick(fn) { onTick = fn; },
    kick() { alpha = Math.max(alpha, .55); running = true; clearTimeout(stopT); stopT = setTimeout(() => { running = false; }, 4000); raf = requestAnimationFrame(step); }
  };
}

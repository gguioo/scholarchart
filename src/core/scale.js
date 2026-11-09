/* ============ 比例尺 & "漂亮刻度" ============ */

export function niceTicks(min, max, n = 5) {
  if (min === max) { min -= .5; max += .5; }
  const span = max - min;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  let step;
  if (norm <= 1) step = 1; else if (norm <= 2) step = 2;
  else if (norm <= 2.5) step = 2.5; else if (norm <= 5) step = 5; else step = 10;
  step *= mag;
  const ticks = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
  return { ticks, step, lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step };
}

export function linear(d0, d1, r0, r1) {
  const f = v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  f.invert = v => d0 + (v - r0) / (r1 - r0) * (d1 - d0);
  return f;
}

/* 平滑曲线（保形单调三次插值路径，不会过冲） */
export function smoothPath(pts, tension = 0.85) {
  if (pts.length < 3) return 'M' + pts.map(p => p.join(' ')).join('L');
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const m1 = { x: (p1[0] + p2[0]) / 2, y: (p1[1] + p2[1]) / 2 };
    const dx = (m1.x - (p0[0] + p1[0]) / 2) * tension, dy = (m1.y - (p0[1] + p1[1]) / 2) * tension;
    d += ` C${(p1[0] + dx).toFixed(2)} ${(p1[1] + dy).toFixed(2)}, ${(p2[0] - dx).toFixed(2)} ${(p2[1] - dy).toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/* ============ 悬浮提示（HTML 层，跟随光标） ============ */

let tipEl = null;
function ensure() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'sc-tip';
    tipEl.style.cssText = 'position:fixed;pointer-events:none;z-index:99;background:#fff;border:1px solid #ebebeb;padding:6px 9px;font-size:11.5px;line-height:1.7;color:#2a2a28;box-shadow:0 2px 10px rgba(0,0,0,.07);display:none;white-space:nowrap';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
export function tip(html, ev) {
  const t = ensure();
  t.innerHTML = html; t.style.display = 'block';
  move(ev);
}
function move(ev) {
  const t = ensure();
  const x = Math.min(ev.clientX + 14, innerWidth - t.offsetWidth - 8);
  const y = Math.min(ev.clientY + 14, innerHeight - t.offsetHeight - 8);
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
export function tipMove(ev) { if (tipEl && tipEl.style.display !== 'none') move(ev); }
export function tipHide() { if (tipEl) tipEl.style.display = 'none'; }

/* 给 SVG 元素挂 hover 高亮 + 提示 */
export function hoverable(node, { enter, leave } = {}) {
  node.addEventListener('pointerenter', ev => { node.__scHot = true; enter && enter(ev); });
  node.addEventListener('pointermove', tipMove);
  node.addEventListener('pointerleave', ev => { node.__scHot = false; leave && leave(ev); tipHide(); });
}

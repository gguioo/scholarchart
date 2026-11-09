/* ============ 导出：SVG / PNG（600dpi 可调）/ 矢量 PDF（打印管线） ============ */

export function exportSVG(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const src = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  download(new Blob([src], { type: 'image/svg+xml' }), fileName('svg'));
}

export function exportPNG(svg, dpi = 600) {
  const mm = { w: +svg.getAttribute('width'), h: +svg.getAttribute('height') };
  const px = {
    w: Math.round(mm.w / 25.4 * dpi),
    h: Math.round(mm.h / 25.4 * dpi)
  };
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const src = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = px.w; c.height = px.h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px.w, px.h);
    ctx.drawImage(img, 0, 0, px.w, px.h);
    c.toBlob(b => download(b, fileName('png')), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
}

/* 矢量 PDF：把 SVG 按物理毫米尺寸放进打印页，浏览器"另存为 PDF"即为矢量
 * （Chrome / Edge 的打印转 PDF 完整保留路径与文字，学术投稿可用） */
export function exportPDF(svg) {
  const w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const src = new XMLSerializer().serializeToString(clone);
  const fw = window.open('', '_blank');
  fw.document.write(`<!DOCTYPE html><html><head><title>${document.title}</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0 }
    html, body { margin: 0; padding: 0 }
    svg { width: ${w}mm; height: ${h}mm; display: block }
  </style></head><body>${src}</body></html>`);
  fw.document.close();
  fw.onload = () => setTimeout(() => { fw.focus(); fw.print(); }, 300);
}

/* 命名：图类型-尺寸-时间 */
function fileName(ext) {
  const t = new Date(), p = n => String(n).padStart(2, '0');
  const size = (window.__scSize || '').replace(/[^0-9x]/g, '');
  return `scholarchart${size ? '-' + size : ''}-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}.${ext}`;
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

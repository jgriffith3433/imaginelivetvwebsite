// Binary-mask morphology for the room-art tools (masks are Uint8Array 0/1, w*h, row-major). No dependencies.

/** Box dilate (or erode when `erode`) by radius r, separable, O(n). */
export function dilate(m, w, h, r, erode = false) {
  const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
  const want = erode ? 0 : 1;
  for (let y = 0; y < h; y++) {
    let cnt = 0;
    const row = y * w;
    for (let x = -r; x < w; x++) {
      const add = x + r, drop = x - r - 1;
      if (add < w && m[row + add] === want) cnt++;
      if (drop >= 0 && m[row + drop] === want) cnt--;
      if (x >= 0) t[row + x] = erode ? (cnt ? 0 : 1) : (cnt ? 1 : 0);
    }
  }
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = -r; y < h; y++) {
      const add = y + r, drop = y - r - 1;
      if (add < h && t[add * w + x] === want) cnt++;
      if (drop >= 0 && t[drop * w + x] === want) cnt--;
      if (y >= 0) o[y * w + x] = erode ? (cnt ? 0 : 1) : (cnt ? 1 : 0);
    }
  }
  return o;
}

export const close = (m, w, h, r) => dilate(dilate(m, w, h, r), w, h, r, true);
export const union = (a, b) => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] | b[i]; return o; };
export const inter = (a, b) => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] & b[i]; return o; };

/** Connected components (4-neighbour). Returns { label: Int32Array, sizes: [0, n1, n2, ...] , boxes }. */
export function components(m, w, h) {
  const label = new Int32Array(m.length);
  const sizes = [0], boxes = [null];
  const stack = new Int32Array(m.length);
  let n = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || label[i]) continue;
    n++;
    let sp = 0, size = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    stack[sp++] = i; label[i] = n;
    while (sp) {
      const p = stack[--sp];
      size++;
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && m[p - 1] && !label[p - 1]) { label[p - 1] = n; stack[sp++] = p - 1; }
      if (x < w - 1 && m[p + 1] && !label[p + 1]) { label[p + 1] = n; stack[sp++] = p + 1; }
      if (y > 0 && m[p - w] && !label[p - w]) { label[p - w] = n; stack[sp++] = p - w; }
      if (y < h - 1 && m[p + w] && !label[p + w]) { label[p + w] = n; stack[sp++] = p + w; }
    }
    sizes.push(size); boxes.push([x0, y0, x1, y1]);
  }
  return { label, sizes, boxes, n };
}

/** Fill the holes of a mask (background not connected to the frame's border). Returns { mask, holes: [sizes of the holes] }. */
export function fillHoles(m, w, h) {
  const inv = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) inv[i] = m[i] ? 0 : 1;
  const c = components(inv, w, h);
  const out = m.slice();
  const holes = [];
  const touches = new Set();
  for (let x = 0; x < w; x++) { touches.add(c.label[x]); touches.add(c.label[(h - 1) * w + x]); }
  for (let y = 0; y < h; y++) { touches.add(c.label[y * w]); touches.add(c.label[y * w + w - 1]); }
  for (let k = 1; k <= c.n; k++) if (!touches.has(k)) holes.push(c.sizes[k]);
  for (let i = 0; i < m.length; i++) if (!m[i] && !touches.has(c.label[i])) out[i] = 1;
  return { mask: out, holes };
}

export const area = (m) => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };

/** Convex hull area of the mask's pixels (monotone chain over per-row extremes: enough for solidity). */
export function hullArea(m, w, h) {
  const pts = [];
  for (let y = 0; y < h; y++) {
    let a = -1, b = -1;
    for (let x = 0; x < w; x++) if (m[y * w + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) { pts.push([a, y]); pts.push([b + 1, y + 1]); pts.push([a, y + 1]); pts.push([b + 1, y]); }
  }
  if (pts.length < 3) return 0;
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  let s = 0;
  for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

/** Bounding box of a mask: [x0, y0, x1, y1] or null. */
export function bbox(m, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}

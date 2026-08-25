// tkcanvas.js — a tkinter Canvas work-alike on top of an HTML5 canvas.
//
// The Python game draws by delete()-ing tagged items and re-creating them, so
// this keeps a retained display list and repaints it every frame. That gives
// delete-by-tag, itemconfig and hit-testing for tag_bind essentially for free.

// The game was written for a 600-wide column. Width stays fixed at 600 so
// every x-coordinate ports unchanged; the height is whatever the device
// actually gives us, exposed as canvas.VH, so screens can use the full
// screen instead of sitting in a letterboxed square.
const VW = 600;
const VH_MIN = 600;         // never present less height than the original had

class TkCanvas {
  constructor(canvasEl) {
    this.el = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.items = [];
    this.widgets = [];       // real DOM inputs, for the tk.Entry equivalents
    this.nextId = 1;
    this.bg = '#000000';
    this.binds = {};          // tag -> { '<Button-1>': fn, ... }
    this.scale = 1;
    this.offX = 0;
    this.offY = 0;
    // Games draw into their original 600-tall box; originY slides that box
    // down the taller viewport without touching a single game coordinate.
    this.originY = 0;
    this.VH = VH_MIN;
    this._resize();
    window.addEventListener('resize', () => {
      this._resize();
      for (const rec of this.widgets) this._placeWidget(rec);
    });
    this._wireInput();
  }

  // --- layout -------------------------------------------------------------
  // Reads the notch / home-indicator insets so nothing important is drawn
  // underneath them.
  _readInsets() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;' +
      'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const t = parseFloat(cs.paddingTop) || 0;
    const b = parseFloat(cs.paddingBottom) || 0;
    probe.remove();
    return { t, b };
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    this.el.width = w * dpr;
    this.el.height = h * dpr;
    this.el.style.width = w + 'px';
    this.el.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ins = this._readInsets();
    const usableH = Math.max(1, h - ins.t - ins.b);

    // Fit the 600-wide column, but never squeeze below the original height.
    this.scale = Math.min(w / VW, usableH / VH_MIN);
    this.offX = (w - VW * this.scale) / 2;   // centres the column on wide screens
    this.offY = ins.t;
    this.VH = usableH / this.scale;          // virtual height actually available
    this.cssW = w; this.cssH = h;
  }

  toVirtual(clientX, clientY) {
    return {
      x: (clientX - this.offX) / this.scale,
      y: (clientY - this.offY) / this.scale - this.originY,
    };
  }

  // --- item creation ------------------------------------------------------
  _add(type, coords, opts) {
    let tags = opts.tags || [];
    if (typeof tags === 'string') tags = [tags];
    const item = { id: this.nextId++, type, coords, opts, tags };
    this.items.push(item);
    return item.id;
  }

  create_rectangle(x1, y1, x2, y2, o = {}) { return this._add('rect', [x1, y1, x2, y2], o); }
  create_oval(x1, y1, x2, y2, o = {}) { return this._add('oval', [x1, y1, x2, y2], o); }
  create_line(x1, y1, x2, y2, o = {}) { return this._add('line', [x1, y1, x2, y2], o); }
  create_text(x, y, o = {}) { return this._add('text', [x, y], o); }
  create_arc(x1, y1, x2, y2, o = {}) { return this._add('arc', [x1, y1, x2, y2], o); }
  create_polygon(points, o = {}) { return this._add('poly', points, o); }

  // --- item mutation ------------------------------------------------------
  find(id) { return this.items.find(i => i.id === id); }

  itemconfig(id, o) {
    const it = this.find(id);
    if (it) Object.assign(it.opts, o);
  }

  coords(id, ...c) {
    const it = this.find(id);
    if (!it) return;
    it.coords = c.length === 1 && Array.isArray(c[0]) ? c[0] : c;
  }

  // tkinter placed real Entry widgets on the canvas via create_window(); the
  // browser equivalent is a positioned <input> floating above it, kept in
  // sync with the canvas transform.
  create_input(x, y, w, h, o = {}) {
    const el = document.createElement('input');
    el.type = o.password ? 'password' : 'text';
    if (o.inputmode) el.inputMode = o.inputmode;
    el.value = o.value ?? '';
    Object.assign(el.style, {
      position: 'fixed', textAlign: 'center', border: '1px solid #888',
      borderRadius: '4px', background: '#fff', color: '#111',
      font: '14px Arial, sans-serif', padding: '0', zIndex: '5',
    });
    document.body.appendChild(el);
    const rec = { el, x, y, w, h };
    this.widgets.push(rec);
    this._placeWidget(rec);
    if (o.focus) setTimeout(() => el.focus(), 0);
    return el;
  }

  _placeWidget(rec) {
    const s = this.scale;
    Object.assign(rec.el.style, {
      left:   (this.offX + (rec.x - rec.w/2) * s) + 'px',
      top:    (this.offY + (rec.y + this.originY - rec.h/2) * s) + 'px',
      width:  (rec.w * s) + 'px',
      height: (rec.h * s) + 'px',
      fontSize: Math.max(11, Math.round(14 * s)) + 'px',
    });
  }

  clearWidgets() {
    for (const rec of this.widgets) rec.el.remove();
    this.widgets = [];
  }

  delete(tag) {
    if (tag === 'all') {
      this.items = [];
      this.binds = {};
      this.clearWidgets();
      return;
    }
    this.items = this.items.filter(i => !i.tags.includes(tag));
    delete this.binds[tag];
  }

  configure(o) { if (o.bg) this.bg = o.bg; }

  // --- events -------------------------------------------------------------
  tag_bind(tag, event, fn) {
    (this.binds[tag] ||= {})[event] = fn;
  }

  _hit(vx, vy) {
    // topmost first, so later-drawn items win
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.tags.length) continue;
      if (!it.tags.some(t => this.binds[t])) continue;
      if (this._pointIn(it, vx, vy)) {
        return it.tags.find(t => this.binds[t]);
      }
    }
    return null;
  }

  _pointIn(it, x, y) {
    const c = it.coords;
    switch (it.type) {
      case 'rect': case 'arc': {
        const [x1, y1, x2, y2] = c;
        return x >= Math.min(x1, x2) && x <= Math.max(x1, x2) &&
               y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
      }
      case 'oval': {
        const [x1, y1, x2, y2] = c;
        const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2;
        const cx = x1 + rx, cy = y1 + ry;
        if (rx <= 0 || ry <= 0) return false;
        return ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1;
      }
      case 'poly': {
        // bounding box is plenty for the rounded-rect buttons this draws
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < c.length; i += 2) {
          minX = Math.min(minX, c[i]);   maxX = Math.max(maxX, c[i]);
          minY = Math.min(minY, c[i + 1]); maxY = Math.max(maxY, c[i + 1]);
        }
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
      }
      case 'text': {
        const [tx, ty] = c;
        const size = fontSize(it.opts.font);
        const txt = String(it.opts.text ?? '');
        const w = size * 0.62 * txt.length, h = size * 1.4;
        const al = alignOf(it.opts.anchor);
        let x1 = tx - w / 2;
        if (al === 'left') x1 = tx;
        if (al === 'right') x1 = tx - w;
        return x >= x1 && x <= x1 + w && y >= ty - h / 2 && y <= ty + h / 2;
      }
      default: return false;
    }
  }

  _wireInput() {
    const fire = (ev, clientX, clientY) => {
      const { x, y } = this.toVirtual(clientX, clientY);
      const tag = this._hit(x, y);
      if (tag && this.binds[tag] && this.binds[tag][ev]) {
        this.binds[tag][ev]({ x, y });
        return true;
      }
      return false;
    };

    this.el.addEventListener('pointerdown', e => {
      e.preventDefault();
      // hover-equivalent: tkinter used <Enter> to move the selection cursor,
      // so a touch does both the select and the activate in one go.
      fire('<Enter>', e.clientX, e.clientY);
      fire('<Button-1>', e.clientX, e.clientY);
    }, { passive: false });

    // real pointing devices still get hover highlighting
    this.el.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      fire('<Enter>', e.clientX, e.clientY);
    });
  }

  // --- painting -----------------------------------------------------------
  render() {
    const g = this.ctx;
    g.save();
    g.fillStyle = this.bg;
    g.fillRect(0, 0, this.cssW, this.cssH);
    g.translate(this.offX, this.offY);
    g.scale(this.scale, this.scale);
    // clip to the column so nothing bleeds into the side bars on wide screens
    g.beginPath(); g.rect(0, 0, VW, this.VH); g.clip();
    g.translate(0, this.originY);
    for (const it of this.items) this._paint(g, it);
    g.restore();
  }

  _paint(g, it) {
    const o = it.opts, c = it.coords;
    const fill = norm(o.fill), outline = norm(o.outline), width = o.width ?? 1;

    switch (it.type) {
      case 'rect': {
        const [x1, y1, x2, y2] = c;
        if (fill) { g.fillStyle = fill; g.fillRect(x1, y1, x2 - x1, y2 - y1); }
        if (outline) { g.strokeStyle = outline; g.lineWidth = width; g.strokeRect(x1, y1, x2 - x1, y2 - y1); }
        break;
      }
      case 'oval': {
        const [x1, y1, x2, y2] = c;
        const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2;
        g.beginPath();
        g.ellipse(x1 + rx, y1 + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        if (fill) { g.fillStyle = fill; g.fill(); }
        if (outline) { g.strokeStyle = outline; g.lineWidth = width; g.stroke(); }
        break;
      }
      case 'line': {
        const [x1, y1, x2, y2] = c;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
        g.strokeStyle = fill || outline || '#fff'; g.lineWidth = width; g.stroke();
        break;
      }
      case 'arc': {
        const [x1, y1, x2, y2] = c;
        const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2;
        // tkinter angles run counter-clockwise from 3 o'clock, canvas runs clockwise
        const s = -(o.start ?? 0) * Math.PI / 180;
        const e = -((o.start ?? 0) + (o.extent ?? 90)) * Math.PI / 180;
        g.beginPath();
        g.ellipse(x1 + rx, y1 + ry, Math.abs(rx), Math.abs(ry), 0, s, e, true);
        if (o.style === 'arc') {
          g.strokeStyle = outline || '#fff'; g.lineWidth = width; g.stroke();
        } else {
          g.lineTo(x1 + rx, y1 + ry); g.closePath();
          if (fill) { g.fillStyle = fill; g.fill(); }
          if (outline) { g.strokeStyle = outline; g.lineWidth = width; g.stroke(); }
        }
        break;
      }
      case 'poly': {
        g.beginPath();
        if (o.smooth) smoothPath(g, c); else {
          g.moveTo(c[0], c[1]);
          for (let i = 2; i < c.length; i += 2) g.lineTo(c[i], c[i + 1]);
        }
        g.closePath();
        if (fill) { g.fillStyle = fill; g.fill(); }
        if (outline) { g.strokeStyle = outline; g.lineWidth = width; g.stroke(); }
        break;
      }
      case 'text': {
        const [x, y] = c;
        const [fam, size, style] = parseFont(o.font);
        g.font = `${style ? style + ' ' : ''}${size}px ${fam}`;
        g.fillStyle = fill || '#fff';
        g.textBaseline = 'middle';
        g.textAlign = alignOf(o.anchor);
        const lines = String(o.text ?? '').split('\n');
        const lh = size * 1.25;
        const y0 = y - (lines.length - 1) * lh / 2;
        lines.forEach((ln, i) => g.fillText(ln, x, y0 + i * lh));
        break;
      }
    }
  }
}

// tkinter treats '' as "no colour"; canvas treats it as an error.
function norm(c) { return (c === '' || c == null) ? null : c; }

function parseFont(f) {
  if (!f) return ['Helvetica Neue, Helvetica, Arial, sans-serif', 14, ''];
  const [fam, size, style] = Array.isArray(f) ? f : [f, 14, ''];
  const stack = /helvetica/i.test(fam)
    ? '"Helvetica Neue", Helvetica, Arial, sans-serif'
    : `${fam}, Arial, sans-serif`;
  return [stack, size || 14, style === 'bold' ? 'bold' : style === 'italic' ? 'italic' : ''];
}

function fontSize(f) { return parseFont(f)[1]; }

// tkinter anchors are compass points ('w', 'ne', ...) or the literal
// 'center'. Note that 'center' contains an 'e', so these must be matched
// exactly rather than by substring.
function alignOf(anchor) {
  const a = (anchor || 'center').toLowerCase();
  if (a === 'center') return 'center';
  if (a.includes('w')) return 'left';
  if (a.includes('e')) return 'right';
  return 'center';
}

// tkinter's smooth=True draws a closed quadratic spline through the points.
function smoothPath(g, c) {
  const pts = [];
  for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]);
  g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const cur = pts[i], nxt = pts[(i + 1) % n];
    m = mid(cur, nxt);
    g.quadraticCurveTo(cur[0], cur[1], m[0], m[1]);
  }
}

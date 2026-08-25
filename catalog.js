// catalog.js — the store catalogues and shared icon renderers.

const STORE_THEME_ITEMS = { brown: 250, yellow: 500, neon_orange: 1000 };
const STORE_ENERGY_THEME_ITEMS = { emerald: 100, sky_blue: 100 };

const STORE_SNAKE_ITEMS = {
  snake_neon_blue: { colors: ['#00d4ff', '#0077ff', '#7df9ff'], price: 100 },
  snake_neon_red:  { colors: ['#ff0044', '#ff4d4d', '#c9001f'], price: 1000 },
  snake_rainbow:   { colors: ['#ff0000','#ff9900','#ffee00','#33ff00','#0099ff','#9900ff'], price: 10000 },
  snake_dark_warrior: {
    name:'DARK WARRIOR', price:100000,
    palette:{ B:'#0d0d0f', R:'#dc2626', S:'#71717a', G:'#3f3f46' },
    head_pattern:['BBBBB','BRBRB','BBBBB','BSSSB','BBBBB'],
    body_pattern:['BBBBB','BBBBB','BGGGB','BBBBB','BBBBB'] },
  snake_sponge_buddy: {
    name:'SPONGE BUDDY', price:250000,
    palette:{ Y:'#facc15', P:'#b45309' },
    head_pattern:['YYYYY','YPYPY','YYYYY','YPYPY','YYYYY'],
    body_pattern:['YPYPY','YYYYY','YPYPY','YYYYY','YPYPY'] },
  snake_natural: {
    name:'AU NATUREL', price:100000000,
    palette:{ H:'#3f2a1d', F:'#e8b48c' },
    head_pattern:['HHHHH','FFFFF','FFFFF','FFFFF','FFFFF'],
    body_pattern:['FFFFF','FFFFF','FFFFF','FFFFF','FFFFF'] },
  snake_blue_mastermind: {
    name:'BLUE MASTERMIND', price:100, currency:'energy',
    palette:{ B:'#3b82f6', E:'#0f172a', D:'#1e1b4b', C:'#eab308' },
    head_pattern:['BBBBB','BBBBB','BEBEB','BBBBB','DDDDD'],
    body_pattern:['DDDDD','DCCCD','DDDDD','DCCCD','DDDDD'] },
  snake_web_slinger: {
    name:'WEB SLINGER', price:250, currency:'energy',
    palette:{ R:'#dc2626', W:'#f8fafc', B:'#1d4ed8', K:'#18181b' },
    head_pattern:['RRRRR','RWRWR','RRKRR','RWRWR','RRRRR'],
    body_pattern:['BBRBB','BRRRB','RRRRR','BRRRB','BBRBB'] },
  snake_wizard: {
    name:'WIZARD', price:500, currency:'energy',
    palette:{ P:'#7c3aed', F:'#e8b48c', B:'#0f172a', S:'#facc15' },
    head_pattern:['..P..','.PPP.','PPPPP','FFFFF','FBFBF'],
    body_pattern:['PPPPP','PSPSP','PPPPP','PSPSP','PPPPP'] },
};

const STORE_FLAPPY_ITEMS = {
  flappy_neon_pink:  { colors:['#ff2fb0'], price:2000 },
  flappy_neon_green: { colors:['#39ff14'], price:40000 },
  flappy_rainbow:    { colors:['#ff0000','#ff9900','#ffee00','#33ff00','#0099ff','#9900ff'], price:80000 },
};

const STORE_SI_ITEMS = {
  si_neon_cyan: { colors:['#00eaff','#7dfcff'], price:4000 },
  si_inferno:   { colors:['#ff4d00','#ffb347'], price:10000 },
  si_galaxy:    { colors:['#a855f7','#e879f9'], price:50000 },
};

const STORE_LEVEL_ITEMS = {
  esoteric_snake:       { price:6666 },
  flappy_alt_dimension: { price:7777 },
};

const STORE_MULTIPLIER_ITEMS = {
  mult_2x:  { mult:2,  duration:300, price:1000 },
  mult_5x:  { mult:5,  duration:180, price:2500 },
  mult_10x: { mult:10, duration:120, price:5000 },
};

const LEVEL_TITLES = {
  esoteric_snake: 'ESOTERIC\nSNAKE',
  flappy_alt_dimension: 'ALT\nDIMENSION',
};

// --- Space Invaders layout / scoring -------------------------------------
const SI_ENEMY_ROWS = 4, SI_ENEMY_COLS = 8;
const SI_ENEMY_W = 32, SI_ENEMY_H = 20;
const SI_ENEMY_GAP_X = 46, SI_ENEMY_GAP_Y = 34;
const SI_ENEMY_START_X = 60, SI_ENEMY_START_Y = 90;
const SI_ROW_POINTS = [30, 20, 20, 10];

// --- Sword Arena ----------------------------------------------------------
const ARENA_WAVE_COMPOSITION = [
  [2,0,0],[2,1,0],[2,2,1],[3,2,1],[3,3,2],
  [3,2,1],[3,3,2],[4,3,2],[4,4,2],[5,4,3],
];
const ARENA_MAP_THEMES = [
  { bg:'#16241a', accent:'#4ade80', name:'VERDANT ARENA' },
  { bg:'#2a1616', accent:'#f87171', name:'EMBER ARENA' },
];
const ARENA_SWING_TICKS = 12;


// --- icon renderers -------------------------------------------------------
Object.assign(ArcadeApp.prototype, {

  draw_snake_icon(cx, cy, colors, tag) {
    const c = colors.length >= 2 ? colors : [colors[0], colors[0]];
    this.canvas.create_rectangle(cx-18, cy-9, cx, cy+9, { fill:c[0], outline:'', tags:[tag] });
    this.canvas.create_rectangle(cx-36, cy-9, cx-18, cy+9, { fill:c[1], outline:'', tags:[tag] });
  },

  // Generic mini-sprite renderer: a grid of characters as small coloured
  // squares, anchored top-left. Characters with no palette entry stay clear.
  draw_pixel_pattern(x0, y0, pattern, palette, cell, tag) {
    pattern.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const color = palette[ch];
        if (!color) return;
        const x = x0 + c*cell, y = y0 + r*cell;
        this.canvas.create_rectangle(x, y, x+cell, y+cell,
          { fill:color, outline:'', tags: tag ? [tag] : [] });
      });
    });
  },

  draw_snake_icon_pattern(cx, cy, item, tag, seg=18) {
    const cell = seg / item.head_pattern.length;
    this.draw_pixel_pattern(cx-seg,     cy-seg/2, item.head_pattern, item.palette, cell, tag);
    this.draw_pixel_pattern(cx-2*seg,   cy-seg/2, item.body_pattern, item.palette, cell, tag);
  },

  draw_snake_icon_smart(cx, cy, item, tag, seg=18) {
    if (item.head_pattern) this.draw_snake_icon_pattern(cx, cy, item, tag, seg);
    else this.draw_snake_icon(cx, cy, item.colors, tag);
  },

  _shade_color(hex, factor) {
    const h = hex.replace('#','');
    let r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    if (factor >= 0) {
      r = Math.round(r + (255-r)*factor); g = Math.round(g + (255-g)*factor); b = Math.round(b + (255-b)*factor);
    } else {
      r = Math.round(r*(1+factor)); g = Math.round(g*(1+factor)); b = Math.round(b*(1+factor));
    }
    const cl = v => Math.max(0, Math.min(255, v)).toString(16).padStart(2,'0');
    return `#${cl(r)}${cl(g)}${cl(b)}`;
  },

  draw_flappy_icon(cx, cy, colors, tag) {
    const color = colors && colors.length ? colors[0] : YELLOW;
    this.canvas.create_oval(cx-15, cy-15, cx+15, cy+15,
      { fill:color, outline:BLACK, width:2, tags:[tag] });
  },

  // 3D-shaded smiley — only used for the Flappy-based unlockable level icon.
  draw_smiley_icon(cx, cy, tag, color=YELLOW, r=15) {
    const shadow = this._shade_color(color, -0.35);
    const highlight = this._shade_color(color, 0.55);
    const lw = Math.max(1, Math.round(r/7));
    this.canvas.create_oval(cx-r, cy-r, cx+r, cy+r, { fill:color, outline:BLACK, width:lw, tags:[tag] });
    this.canvas.create_arc(cx-r, cy-r, cx+r, cy+r,
      { start:250, extent:120, fill:shadow, outline:'', style:'pieslice', tags:[tag] });
    this.canvas.create_oval(cx-r*0.6, cy-r*0.67, cx-r*0.13, cy-r*0.27, { fill:highlight, outline:'', tags:[tag] });
    this.canvas.create_oval(cx-r*0.4, cy-r*0.2, cx-r*0.13, cy+r*0.07, { fill:BLACK, outline:'', tags:[tag] });
    this.canvas.create_oval(cx+r*0.13, cy-r*0.2, cx+r*0.4, cy+r*0.07, { fill:BLACK, outline:'', tags:[tag] });
    this.canvas.create_arc(cx-r*0.47, cy-r*0.27, cx+r*0.47, cy+r*0.6,
      { start:200, extent:140, style:'arc', outline:BLACK, width:lw, tags:[tag] });
  },

  draw_si_ship_icon(cx, cy, ship_color, tag, bullet_color=null, w=30, h=16) {
    const tags = tag ? [tag] : [];
    this.canvas.create_polygon([cx, cy-h, cx-w/2, cy+h/2, cx+w/2, cy+h/2],
      { fill:ship_color, outline:WHITE, tags });
    this.canvas.create_rectangle(cx-4, cy-h-6, cx+4, cy-h, { fill:ship_color, outline:WHITE, tags });
    if (bullet_color)
      this.canvas.create_oval(cx-3, cy+h/2+4, cx+3, cy+h/2+10, { fill:bullet_color, outline:'', tags });
  },

  draw_level_icon(cx, cy, level_id, tag, scale=4) {
    if (level_id === 'flappy_alt_dimension') {
      this.draw_smiley_icon(cx, cy, tag, '#7a1e8a', 15*(scale/4));
      return;
    }
    const px = scale;
    const grid = ['  ##  ',' #### ','######','#.##.#','######',' #  # '];
    const sx = cx - (grid[0].length*px)/2;
    const sy = cy - (grid.length*px)/2;
    grid.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch !== '#' && ch !== '.') return;
        const x = sx + c*px, y = sy + r*px;
        this.canvas.create_rectangle(x, y, x+px, y+px,
          { fill: ch === '#' ? GREEN : BLACK, outline:'', tags:[tag] });
      });
    });
    const ty = sy + grid.length*px;
    this.canvas.create_line(cx, ty, cx, ty+px*1.5,
      { fill:RED, width:Math.max(1, Math.floor(px/2)), tags:[tag] });
  },

  draw_invader_icon(cx, cy, row) {
    const colors = ['#ff5ba8','#5b8cff','#4ee08a','#facc15'];
    const color = colors[row % colors.length];
    const w = SI_ENEMY_W, h = SI_ENEMY_H;
    this.canvas.create_rectangle(cx-w/2, cy-h/2, cx+w/2, cy+h/2, { fill:color, outline:BLACK });
    this.canvas.create_oval(cx-6, cy-4, cx-2, cy, { fill:BLACK, outline:'' });
    this.canvas.create_oval(cx+2, cy-4, cx+6, cy, { fill:BLACK, outline:'' });
  },

  // --- active-skin lookups ------------------------------------------------
  get_active_snake_skin() {
    return this.active_snake_id ? STORE_SNAKE_ITEMS[this.active_snake_id] : null;
  },
  get_active_flappy_colors() {
    const it = this.active_flappy_id ? STORE_FLAPPY_ITEMS[this.active_flappy_id] : null;
    return it ? it.colors : [YELLOW];
  },
  get_active_si_ship_color() {
    const it = this.active_si_id ? STORE_SI_ITEMS[this.active_si_id] : null;
    return it ? it.colors[0] : null;
  },
  get_active_si_bullet_color() {
    const it = this.active_si_id ? STORE_SI_ITEMS[this.active_si_id] : null;
    return it ? it.colors[1] : YELLOW;
  },
});

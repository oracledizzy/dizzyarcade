// game.js — port of ArcadeApp's shell: state, themes, menus, persistence.

const BLUE='#1e3a8a', RED='#b91c1c', BLACK='#000000', WHITE='#ffffff',
      YELLOW='#facc15', GREEN='#22c55e', PURPLE='#a855f7';

const VOLUME_TIERS = { OFF:0.0, LOW:0.3, MID:0.6, LOUD:1.0 };

const THEME_HUES = {
  navy:   { dark:{primary:'#1e3a8a',secondary:'#b91c1c',accent:'#5b8cff',bg:'#0b0b0f',text:'#f2f2f5',muted:'#7a7a85'},
            light:{primary:'#b91c1c',secondary:'#1e3a8a',accent:'#3b6fe0',bg:'#f5f5f7',text:'#111114',muted:'#6b6b76'}, swatch:'#3b6fe0' },
  pink:   { dark:{primary:'#8a1e5a',secondary:'#1e8a6a',accent:'#ff5ba8',bg:'#0b0b0f',text:'#f2f2f5',muted:'#7a7a85'},
            light:{primary:'#1e8a6a',secondary:'#8a1e5a',accent:'#e0399e',bg:'#f5f5f7',text:'#111114',muted:'#6b6b76'}, swatch:'#e0399e' },
  green:  { dark:{primary:'#1e6a3a',secondary:'#8a1e5a',accent:'#4ee08a',bg:'#0b0b0f',text:'#f2f2f5',muted:'#7a7a85'},
            light:{primary:'#8a1e5a',secondary:'#1e6a3a',accent:'#1fa855',bg:'#f5f5f7',text:'#111114',muted:'#6b6b76'}, swatch:'#1fa855' },
  yellow: { dark:{primary:'#854d0e',secondary:'#ca8a04',accent:'#facc15',bg:'#12110b',text:'#fef9c3',muted:'#a1a1aa'},
            light:{primary:'#ca8a04',secondary:'#854d0e',accent:'#eab308',bg:'#fefce8',text:'#422006',muted:'#71717a'}, swatch:'#eab308' },
  brown:  { dark:{primary:'#78350f',secondary:'#451a03',accent:'#d97706',bg:'#1a120b',text:'#fde68a',muted:'#a1a1aa'},
            light:{primary:'#451a03',secondary:'#78350f',accent:'#b45309',bg:'#fdf8f6',text:'#291304',muted:'#71717a'}, swatch:'#b45309' },
  neon_orange:{ dark:{primary:'#c2410c',secondary:'#0c4a6e',accent:'#ff7a1a',bg:'#0b0b0f',text:'#fff3e0',muted:'#7a7a85'},
            light:{primary:'#0c4a6e',secondary:'#c2410c',accent:'#ea580c',bg:'#f5f5f7',text:'#111114',muted:'#6b6b76'}, swatch:'#ff6a00' },
  matrix: { dark:{primary:'#003300',secondary:'#00ff41',accent:'#00ff41',bg:'#000000',text:'#00ff41',muted:'#008f11'},
            light:{primary:'#00ff41',secondary:'#003300',accent:'#00cc33',bg:'#001a00',text:'#00ff41',muted:'#00b82e'}, swatch:'#00ff41' },
  emerald:{ dark:{primary:'#059669',secondary:'#047857',accent:'#34d399',bg:'#022c22',text:'#ecfdf5',muted:'#7a7a85'},
            light:{primary:'#34d399',secondary:'#059669',accent:'#10b981',bg:'#ecfdf5',text:'#022c22',muted:'#6b6b76'}, swatch:'#10b981' },
  sky_blue:{ dark:{primary:'#0284c7',secondary:'#0369a1',accent:'#38bdf8',bg:'#0c1e2e',text:'#f0f9ff',muted:'#7a7a85'},
            light:{primary:'#38bdf8',secondary:'#0284c7',accent:'#0ea5e9',bg:'#f0f9ff',text:'#0c1e2e',muted:'#6b6b76'}, swatch:'#0ea5e9' },
};

const SAVE_KEY = 'dizzyarcade.save.v1';

class ArcadeApp {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.audio = audio;

    this.inverted = false;
    this.theme_hue = 'navy';

    this.menu_items = [];
    this.menu_selected_index = 0;
    this.menu_active = false;
    this.esc_back_command = null;
    this.game_job = null;
    this.game_running = false;

    this.high_scores = this.loadHighScores();
    this.tokens = this.high_scores.TOKENS ?? 0;
    this.energy = this.high_scores.ENERGY ?? 0;
    this.unlocked_themes = this.high_scores.UNLOCKED_THEMES ?? ['navy','pink','green'];
    this.unlocked_levels = this.high_scores.UNLOCKED_LEVELS ?? [];
    this.multiplier_expiry = 0;
    this.multiplier_value = 1;

    this.audio.setVolumeTier(this.high_scores.VOLUME_TIER ?? 'MID');
    this.inverted = this.high_scores.INVERTED ?? false;
    this.theme_hue = this.high_scores.THEME_HUE ?? 'navy';
    this.audio.musicEnabled = this.high_scores.MUSIC_ENABLED ?? true;
    this.audio.specialSounds = this.high_scores.SFX_ENABLED ?? true;

    this._wireKeys();
  }

  // --- persistence --------------------------------------------------------
  loadHighScores() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
    catch { return {}; }
  }

  saveHighScores() {
    const d = this.high_scores;
    d.TOKENS = this.tokens;
    d.ENERGY = this.energy;
    d.UNLOCKED_THEMES = this.unlocked_themes;
    d.UNLOCKED_LEVELS = this.unlocked_levels;
    d.VOLUME_TIER = this.audio.volumeTier;
    d.INVERTED = this.inverted;
    d.THEME_HUE = this.theme_hue;
    d.MUSIC_ENABLED = this.audio.musicEnabled;
    d.SFX_ENABLED = this.audio.specialSounds;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch {}
  }

  format_tokens(n) {
    // Player-facing balances are always shown in full, never abbreviated.
    return Math.floor(n).toLocaleString('en-US');
  }

  get_active_multiplier() {
    return (Date.now()/1000 < this.multiplier_expiry) ? this.multiplier_value : 1;
  }

  play_sound(name) { this.audio.play(name); }
  play_music(p) { this.audio.playMusic(p); }
  stop_music() { this.audio.stopMusic(); }

  handle_click(action) { this.play_sound('click'); action(); }

  // --- themes -------------------------------------------------------------
  get_theme() {
    const hue = THEME_HUES[this.theme_hue] || THEME_HUES.navy;
    const v = this.inverted ? hue.light : hue.dark;
    return { ...v,
      bg:v.bg, text:v.text, muted:v.muted,
      btn_bg: this.inverted ? BLACK : WHITE,
      btn_fg: this.inverted ? WHITE : BLACK };
  }

  rounded_rect(x1,y1,x2,y2,r,o={}) {
    const pts = [x1+r,y1, x2-r,y1, x2,y1, x2,y1+r, x2,y2-r, x2,y2,
                 x2-r,y2, x1+r,y2, x1,y2, x1,y2-r, x1,y1+r, x1,y1];
    return this.canvas.create_polygon(pts, { smooth:true, ...o });
  }

  // --- menu plumbing ------------------------------------------------------
  make_menu_item(text, command, theme, cx, cy, w=180, h=46) {
    const idx = this.menu_items.length;
    const tag = `menu_item_${idx}`;
    const rect = this.rounded_rect(cx-w/2, cy-h/2, cx+w/2, cy+h/2, h/2,
                                   { fill:theme.bg, outline:'', tags:[tag] });
    const tid = this.canvas.create_text(cx, cy,
                  { text, fill:theme.muted, font:['Helvetica Neue',14], tags:[tag] });
    this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(command));
    this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
    this.menu_items.push({ rect, text:tid, type:'standard', cx, cy, w, h, command });
  }

  set_menu_selection(i) {
    if (i !== this.menu_selected_index) this.play_sound('menu_move');
    this.menu_selected_index = i;
    this.refresh_menu_highlight();
  }

  refresh_menu_highlight() {
    if (!this.menu_items.length) return;
    const theme = this.get_theme();
    this.canvas.delete('menu_highlight');
    this.menu_items.forEach((item,i) => {
      if (item.type === 'standard')
        this.canvas.itemconfig(item.text,
          { fill: i === this.menu_selected_index ? theme.accent : theme.muted });
    });
    const s = this.menu_items[this.menu_selected_index];
    if (!s) return;
    const pad = 6;
    this.rounded_rect(s.cx-s.w/2-pad, s.cy-s.h/2-pad, s.cx+s.w/2+pad, s.cy+s.h/2+pad,
                      s.h/2+pad, { outline:RED, width:2, fill:'', tags:['menu_highlight'] });
  }

  menu_navigate_2d(direction) {
    if (!this.menu_active || !this.menu_items.length) return;
    const cur = this.menu_items[this.menu_selected_index];
    const {cx, cy} = cur;
    const cands = [];
    this.menu_items.forEach((item,i) => {
      if (i === this.menu_selected_index) return;
      const {cx:ix, cy:iy} = item;
      if (direction==='LEFT'  && ix < cx-5)  cands.push([(cx-ix)+Math.abs(cy-iy)*4, i]);
      if (direction==='RIGHT' && ix > cx+5)  cands.push([(ix-cx)+Math.abs(cy-iy)*4, i]);
      if (direction==='UP'    && iy < cy-10) cands.push([(cy-iy)*4+Math.abs(cx-ix), i]);
      if (direction==='DOWN'  && iy > cy+10) cands.push([(iy-cy)*4+Math.abs(cx-ix), i]);
    });
    if (cands.length) { cands.sort((a,b)=>a[0]-b[0]); this.set_menu_selection(cands[0][1]); }
    else if (direction==='UP' || direction==='DOWN') {
      const step = direction==='UP' ? -1 : 1;
      const n = this.menu_items.length;
      this.set_menu_selection(((this.menu_selected_index+step)%n+n)%n);
    }
  }

  menu_activate_selection() {
    if (!this.menu_active || !this.menu_items.length) return;
    this.handle_click(this.menu_items[this.menu_selected_index].command);
  }

  _wireKeys() {
    window.addEventListener('keydown', e => {
      const k = e.key;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k)) e.preventDefault();
      if (this.onKey && this.onKey(k)) return;
      if (!this.menu_active) return;
      if (k==='ArrowUp') this.menu_navigate_2d('UP');
      else if (k==='ArrowDown') this.menu_navigate_2d('DOWN');
      else if (k==='ArrowLeft') this.menu_navigate_2d('LEFT');
      else if (k==='ArrowRight') this.menu_navigate_2d('RIGHT');
      else if (k==='Enter' || k===' ') this.menu_activate_selection();
      else if (k==='Escape' && this.esc_back_command) {
        this.play_sound('esc'); this.esc_back_command();
      }
    });
  }

  // --- screen lifecycle ---------------------------------------------------
  clear_screen() {
    if (this.game_job) { clearTimeout(this.game_job); this.game_job = null; }
    this.game_running = false;
    this.menu_active = false;
    this.menu_items = [];
    this.menu_selected_index = 0;
    this.onKey = null;
    this.esc_back_command = null;
    this.clearSwipeHandler();
    this.clearTapHandler();
    this.canvas.delete('all');
  }

  draw_token_header(theme) {
    this.canvas.create_rectangle(0,0,600,58,{ fill:theme.bg, outline:'' });
    this.canvas.create_oval(20,8,34,22,{ fill:YELLOW, outline:'' });
    this.canvas.create_text(42,15,{ text:`TOKENS: ${this.format_tokens(this.tokens)}`,
      fill:YELLOW, font:['Arial',11,'bold'], anchor:'w' });
    this.canvas.create_oval(20,27,34,41,{ fill:PURPLE, outline:'' });
    this.canvas.create_text(42,34,{ text:`ENERGY: ${this.format_tokens(this.energy)}`,
      fill:PURPLE, font:['Arial',11,'bold'], anchor:'w' });
    const mult = this.get_active_multiplier();
    if (mult > 1) {
      const rem = Math.max(0, Math.floor(this.multiplier_expiry - Date.now()/1000));
      this.canvas.create_text(580,15,{ text:`${mult}x SCORE  ${Math.floor(rem/60)}:${String(rem%60).padStart(2,'0')}`,
        fill:GREEN, font:['Arial',10,'bold'], anchor:'e' });
    }
  }

  // --- SCREEN 1: MAIN MENU ------------------------------------------------
  show_main_menu() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_sound('menu_open');
    this.play_music('sound/menu_music.m4a');

    this.draw_token_header(theme);
    this.canvas.create_text(300,140,{ text:'DIZZY ARCADE', fill:theme.text, font:['Helvetica Neue',46] });

    this.make_menu_item('PLAY',      () => this.show_play_menu(),     theme, 300, 210);
    this.make_menu_item('CUSTOMIZE', () => this.show_stub('CUSTOMIZE'), theme, 300, 270);
    this.make_menu_item('STORE',     () => this.show_stub('STORE'),   theme, 300, 330);
    this.make_menu_item('SETTINGS',  () => this.show_settings_menu(), theme, 300, 390);
    this.make_menu_item('OTHER',     () => this.show_stub('OTHER'),   theme, 300, 450);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  }

  // --- SCREEN 2: GAME SELECT ----------------------------------------------
  make_play_menu_item(text, command, theme, cy, high_score=null) {
    const w = 220, h = 46, cx = 300;
    const idx = this.menu_items.length;
    const tag = `menu_item_${idx}`;
    const rect = this.rounded_rect(cx-w/2, cy-h/2, cx+w/2, cy+h/2, h/2,
                                   { fill:theme.bg, outline:'', tags:[tag] });
    const tid = this.canvas.create_text(cx, high_score!==null ? cy-8 : cy,
                  { text, fill:theme.muted, font:['Helvetica Neue',14], tags:[tag] });
    if (high_score !== null)
      this.canvas.create_text(cx, cy+13, { text:`BEST: ${this.format_tokens(high_score)}`,
        fill:theme.muted, font:['Arial',9], tags:[tag] });
    this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(command));
    this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
    this.menu_items.push({ rect, text:tid, type:'standard', cx, cy, w, h, command });
  }

  show_play_menu() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_main_menu();
    this.play_sound('menu_open');

    this.draw_token_header(theme);
    this.canvas.create_text(300,80,{ text:'SELECT A GAME', fill:theme.text, font:['Helvetica Neue',28] });

    const hs = this.high_scores;
    let y = 130;
    this.make_play_menu_item('SNAKE GAME', () => this.start_snake(), theme, y, hs.SNAKE ?? 0); y += 58;
    this.make_play_menu_item('FLAPPY BIRD', () => this.start_flappy(), theme, y, hs.FLAPPY ?? 0); y += 58;
    this.make_play_menu_item('PONG (2 PLAYER)', () => this.show_stub('PONG'), theme, y, hs.PONG ?? 0); y += 58;
    this.make_play_menu_item('SPACE INVADERS', () => this.show_stub('SPACE INVADERS'), theme, y, hs.SPACE_INVADERS ?? 0); y += 58;
    this.make_play_menu_item('SWORD ARENA', () => this.show_stub('SWORD ARENA'), theme, y, hs.ARENA_BEST_WAVE ?? 0); y += 58;
    this.make_play_menu_item('BLACKJACK', () => this.show_stub('BLACKJACK'), theme, y, hs.BLACKJACK ?? 0); y += 58;

    this.make_menu_item('< MAIN MENU', () => this.show_main_menu(), theme, 300, Math.min(y+12,565), 200);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  }

  // --- SETTINGS -----------------------------------------------------------
  build_theme_picker(theme, cy=254) {
    const hues = this.unlocked_themes, spacing = 56;
    const offset = -(hues.length-1)/2 * spacing;
    hues.forEach((hue,i) => {
      const cx = 300 + offset + i*spacing;
      const idx = this.menu_items.length;
      const tag = `theme_${hue}`;
      this.canvas.create_oval(cx-15,cy-15,cx+15,cy+15,
        { fill:THEME_HUES[hue].swatch, outline:'', tags:[tag] });
      if (hue === this.theme_hue)
        this.canvas.create_oval(cx-20,cy-20,cx+20,cy+20,
          { outline:theme.text, width:2, fill:'', tags:[tag] });
      const cmd = () => { this.theme_hue = hue; this.saveHighScores(); this.show_settings_menu(); };
      this.canvas.tag_bind(tag,'<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag,'<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx, cy, w:40, h:40, command:cmd });
    });
  }

  draw_minimalist_speaker(cx, cy, tier, color, tag) {
    this.canvas.create_rectangle(cx-10,cy-4,cx-6,cy+4,{ fill:color, outline:'', tags:[tag] });
    this.canvas.create_polygon([cx-6,cy-4, cx-1,cy-8, cx-1,cy+8, cx-6,cy+4],
      { fill:color, outline:'', tags:[tag] });
    if (tier === 'OFF') {
      this.canvas.create_line(cx+3,cy-4,cx+9,cy+4,{ fill:color, width:2, tags:[tag] });
      this.canvas.create_line(cx+9,cy-4,cx+3,cy+4,{ fill:color, width:2, tags:[tag] });
    } else {
      const bars = { LOW:1, MID:2, LOUD:3 }[tier] ?? 0;
      for (let b=0; b<bars; b++) {
        const r = 4 + b*4;
        this.canvas.create_arc(cx-1-r, cy-r, cx-1+r, cy+r,
          { start:-50, extent:100, style:'arc', outline:color, width:2, tags:[tag] });
      }
    }
  }

  build_volume_control(theme, cy=394) {
    const tiers = ['OFF','LOW','MID','LOUD'], spacing = 54;
    const offset = -(tiers.length-1)/2 * spacing;
    tiers.forEach((tier,i) => {
      const cx = 300 + offset + i*spacing;
      const idx = this.menu_items.length;
      const tag = `vol_${tier}`;
      const sel = tier === this.audio.volumeTier;
      this.rounded_rect(cx-22, cy-16, cx+22, cy+16, 16, {
        fill: sel ? theme.accent : theme.bg,
        outline: sel ? theme.accent : theme.muted, width:1, tags:[tag] });
      this.draw_minimalist_speaker(cx, cy, tier, sel ? theme.bg : theme.muted, tag);
      const cmd = () => { this.audio.setVolumeTier(tier); this.saveHighScores(); this.show_settings_menu(); };
      this.canvas.tag_bind(tag,'<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag,'<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx, cy, w:44, h:32, command:cmd });
    });
  }

  show_settings_menu() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_main_menu();
    this.play_sound('menu_open');

    this.draw_token_header(theme);
    this.canvas.create_text(300,76,{ text:'SETTINGS', fill:theme.text, font:['Helvetica Neue',28] });

    this.make_menu_item(`INVERT COLORS: ${this.inverted?'ON':'OFF'}`,
      () => { this.inverted = !this.inverted; this.saveHighScores(); this.show_settings_menu(); },
      theme, 300, 122, 220, 36);

    this.make_menu_item(`MUSIC: ${this.audio.musicEnabled?'ON':'OFF'}`,
      () => { this.audio.musicEnabled = !this.audio.musicEnabled;
              if (!this.audio.musicEnabled) this.audio.stopMusic();
              else this.audio.playMusic('sound/menu_music.m4a');
              this.saveHighScores(); this.show_settings_menu(); },
      theme, 200, 166, 190, 36);

    this.make_menu_item(`SPECIAL SOUNDS: ${this.audio.specialSounds?'ON':'OFF'}`,
      () => { this.audio.specialSounds = !this.audio.specialSounds;
              this.saveHighScores(); this.show_settings_menu(); },
      theme, 420, 166, 190, 36);

    this.canvas.create_text(300,214,{ text:'THEMES', fill:theme.muted, font:['Helvetica Neue',11] });
    this.build_theme_picker(theme, 254);

    this.canvas.create_text(300,344,{ text:'VOLUME', fill:theme.muted, font:['Helvetica Neue',11] });
    this.build_volume_control(theme, 394);

    this.make_menu_item('RESET GAME DATA', () => this.confirm_reset_game_data(), theme, 300, 474, 220, 38);
    this.make_menu_item('< MAIN MENU', () => this.show_main_menu(), theme, 300, 559, 200, 38);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  }

  confirm_reset_game_data() {
    const theme = this.get_theme();
    this.esc_back_command = () => this.show_settings_menu();
    this.play_sound('menu_open');
    const popup_bg = this.inverted ? '#d4d4db' : '#26262e';
    const text_color = this.inverted ? '#111114' : '#ffffff';

    this.canvas.create_rectangle(0,0,600,600,{ fill:'rgba(0,0,0,0.55)', outline:'', tags:['reset_popup'] });
    this.rounded_rect(120,180,480,420,20,{ fill:popup_bg, outline:RED, width:3, tags:['reset_popup'] });
    this.canvas.create_text(300,230,{ text:'ARE YOU SURE?', fill:RED, font:['Helvetica Neue',22,'bold'], tags:['reset_popup'] });
    this.canvas.create_text(300,275,{ text:'This will reset all tokens,\nhigh scores, and purchased items!',
      fill:text_color, font:['Helvetica Neue',13], tags:['reset_popup'] });

    this.menu_active = false;
    this.menu_items = [];

    const mk = (tag, x1, x2, cxv, label, fill, cmd) => {
      const idx = this.menu_items.length;
      this.rounded_rect(x1,335,x2,380,12,{ fill, outline:'', tags:['reset_popup',tag] });
      this.canvas.create_text(cxv,357,{ text:label, fill:WHITE, font:['Helvetica Neue',13,'bold'], tags:['reset_popup',tag] });
      this.canvas.tag_bind(tag,'<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag,'<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx:cxv, cy:357, w:120, h:45, command:cmd });
    };
    mk('reset_yes',160,280,220,'YES',RED, () => this.execute_reset_game_data());
    mk('reset_no', 320,440,380,'NO', theme.muted, () => this.show_settings_menu());

    this.menu_active = true;
    this.menu_selected_index = 0;
  }

  execute_reset_game_data() {
    this.high_scores = {};
    this.tokens = 0; this.energy = 0;
    this.unlocked_themes = ['navy','pink','green'];
    this.unlocked_levels = [];
    this.theme_hue = 'navy'; this.inverted = false;
    this.saveHighScores();
    this.show_main_menu();
  }

  // --- placeholder for the games not yet ported ---------------------------
  show_stub(name) {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_main_menu();
    this.draw_token_header(theme);
    this.canvas.create_text(300,250,{ text:name, fill:theme.text, font:['Helvetica Neue',30] });
    this.canvas.create_text(300,300,{ text:'not ported yet', fill:theme.muted, font:['Arial',13] });
    this.make_menu_item('< BACK', () => this.show_main_menu(), theme, 300, 400, 200);
    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  }
}

// --- shared game-side helpers ---------------------------------------------
Object.assign(ArcadeApp.prototype, {

  add_tokens(amount) {
    this.tokens += amount;
    this.saveHighScores();
  },

  add_energy(amount) {
    this.energy = Math.max(0, this.energy + amount);
    this.saveHighScores();
  },

  // The desktop build told players to "Press ESC for Menu". There is no ESC
  // on a phone, so every game draws this tappable quit chip instead.
  drawQuitButton(theme) {
    const tag = 'quit_btn';
    this.canvas.delete(tag);
    this.rounded_rect(505, 10, 590, 40, 15,
      { fill:'rgba(0,0,0,0.35)', outline: WHITE, width:1, tags:[tag] });
    this.canvas.create_text(547, 25, { text:'MENU', fill:WHITE, font:['Arial',11,'bold'], tags:[tag] });
    this.canvas.tag_bind(tag, '<Button-1>', () => this.quit_to_menu());
  },

  // Leaving mid-run banks whatever coins were picked up, matching the
  // desktop build's ESC behaviour rather than silently dropping them.
  quit_to_menu() {
    if (this.session_tokens_earned > 0) {
      this.add_tokens(this.session_tokens_earned);
      this.session_tokens_earned = 0;
    }
    this.play_sound('esc');
    this.clearSwipeHandler();
    this.show_play_menu();
  },

  // --- swipe input --------------------------------------------------------
  setSwipeHandler(fn) {
    this.clearSwipeHandler();
    const MIN = 24;                       // px of travel before it counts
    let sx = 0, sy = 0, active = false;

    const down = e => { sx = e.clientX; sy = e.clientY; active = true; };
    const up = e => {
      if (!active) return;
      active = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < MIN && Math.abs(dy) < MIN) return;
      fn(Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'Right' : 'Left')
        : (dy > 0 ? 'Down' : 'Up'));
    };

    this._swipe = { down, up };
    this.canvas.el.addEventListener('pointerdown', down);
    this.canvas.el.addEventListener('pointerup', up);
  },

  clearSwipeHandler() {
    if (!this._swipe) return;
    this.canvas.el.removeEventListener('pointerdown', this._swipe.down);
    this.canvas.el.removeEventListener('pointerup', this._swipe.up);
    this._swipe = null;
  },

  setTapHandler(fn) {
    this.clearTapHandler();
    const down = e => fn(this.canvas.toVirtual(e.clientX, e.clientY));
    this._tap = down;
    this.canvas.el.addEventListener('pointerdown', down);
  },

  clearTapHandler() {
    if (!this._tap) return;
    this.canvas.el.removeEventListener('pointerdown', this._tap);
    this._tap = null;
  },

  // --- end of run ---------------------------------------------------------
  end_game(message) {
    this.game_running = false;
    if (this.game_job) { clearTimeout(this.game_job); this.game_job = null; }
    this.clearSwipeHandler();
    this.clearTapHandler();
    this.onKey = null;

    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });
    this.menu_items = [];
    this.esc_back_command = () => this.show_play_menu();

    const current_score = this.score ?? this.flappy_score ?? 0;
    if (current_score > (this.high_scores[this.game_type] ?? 0)) {
      this.high_scores[this.game_type] = current_score;
      this.saveHighScores();
    }
    const best_score = this.high_scores[this.game_type] ?? 0;
    const session_tokens = this.session_tokens_earned ?? 0;

    this.draw_token_header(theme);
    this.canvas.create_text(300,150,{ text:message, fill:RED, font:['Impact',42] });
    this.canvas.create_text(300,220,{ text:`SCORE: ${current_score}`, fill:theme.text, font:['Helvetica Neue',20,'bold'] });
    this.canvas.create_text(300,260,{ text:`HIGH SCORE: ${best_score}`, fill:YELLOW, font:['Helvetica Neue',16] });
    if (session_tokens > 0)
      this.canvas.create_text(300,300,{ text:`TOKENS COLLECTED: +${session_tokens}`, fill:GREEN, font:['Helvetica Neue',14,'bold'] });

    const again = { SNAKE: () => this.start_snake(), FLAPPY: () => this.start_flappy() }[this.game_type]
                  || (() => this.show_play_menu());
    this.make_menu_item('PLAY AGAIN', again, theme, 300, 390, 220);
    this.make_menu_item('GAME MENU', () => this.show_play_menu(), theme, 300, 450, 220);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },
});

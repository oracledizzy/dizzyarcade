// menus.js — game-select and mode-select screens.

Object.assign(ArcadeApp.prototype, {

  build_mode_select_box(cx, cy, w, h, title, subtitle, icon_fn, command, theme, highlight=false) {
    const tag = `mode_box_${title}`.replace(/[\s\n]/g, '_');
    this.rounded_rect(cx-w/2, cy-h/2, cx+w/2, cy+h/2, 16,
      { fill:theme.bg, outline: highlight ? GREEN : theme.muted, width:2, tags:[tag] });
    icon_fn(cx, cy - h/2 + 70, tag);
    this.canvas.create_text(cx, cy+20, { text:title, fill:theme.text, font:['Helvetica Neue',15,'bold'], tags:[tag] });
    this.canvas.create_text(cx, cy+48, { text:subtitle, fill:theme.muted, font:['Arial',10], tags:[tag] });
    const idx = this.menu_items.length;
    this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(command));
    this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
    this.menu_items.push({ type:'custom', cx, cy, w, h, command });
  },

  make_play_menu_item(text, command, theme, cy, opts={}) {
    const { starred=false, level_id=null, high_score=null } = opts;
    const w = starred ? 340 : 300, h = MENU_ITEM_H, cx = 300;
    const idx = this.menu_items.length;
    const tag = `menu_item_${idx}`;
    const rect = this.rounded_rect(cx-w/2, cy-h/2, cx+w/2, cy+h/2, h/2,
      { fill:theme.bg, outline:'', tags:[tag] });
    const tid = this.canvas.create_text(cx, high_score !== null ? cy-8 : cy,
      { text, fill:theme.muted, font:['Helvetica Neue',MENU_FONT], tags:[tag] });
    if (high_score !== null)
      this.canvas.create_text(cx, cy+17, { text:`BEST: ${this.format_tokens(high_score)}`,
        fill:theme.muted, font:['Arial',11], tags:[tag] });
    this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(command));
    this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
    this.menu_items.push({ rect, text:tid, type:'standard', cx, cy, w, h, command });

    if (starred) {
      const bx = cx + w/2 - 26, by = cy;
      this.canvas.create_oval(bx-18, by-18, bx+18, by+18,
        { fill:theme.bg, outline:GREEN, width:2, tags:[tag] });
      this.draw_level_icon(bx, by, level_id, tag, 3);
    }
  },

  show_play_menu() {
    this.clear_screen();
    this.layout_menu();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_main_menu();
    this.play_sound('menu_open');

    this.draw_token_header(theme);

    const ys = this.menu_stack(7, { top: 120, bottom: 30 });
    this.canvas.create_text(300, (66 + ys[0] - MENU_ITEM_H/2) / 2,
      { text:'SELECT A GAME', fill:theme.text, font:['Helvetica Neue',28] });

    const hs = this.high_scores;
    let i = 0;

    if (this.unlocked_levels.includes('esoteric_snake')) {
      const best = Math.max(hs.SNAKE ?? 0, hs.ESOTERIC_SNAKE ?? 0);
      this.make_play_menu_item('SNAKE', () => this.show_snake_mode_select(), theme, ys[i],
        { starred:true, level_id:'esoteric_snake', high_score:best });
    } else {
      this.make_play_menu_item('SNAKE GAME', () => this.show_snake_type_select(), theme, ys[i],
        { high_score: hs.SNAKE ?? 0 });
    }
    i++;

    if (this.unlocked_levels.includes('flappy_alt_dimension')) {
      const best = Math.max(hs.FLAPPY ?? 0, hs.ALT_DIMENSION ?? 0);
      this.make_play_menu_item('FLAPPY BIRD', () => this.show_flappy_mode_select(), theme, ys[i],
        { starred:true, level_id:'flappy_alt_dimension', high_score:best });
    } else {
      this.make_play_menu_item('FLAPPY BIRD', () => this.start_flappy(), theme, ys[i],
        { high_score: hs.FLAPPY ?? 0 });
    }
    i++;

    this.make_play_menu_item('PONG (2 PLAYER)', () => this.prep_pong(), theme, ys[i++], { high_score: hs.PONG ?? 0 });
    this.make_play_menu_item('SPACE INVADERS', () => this.start_space_invaders(), theme, ys[i++], { high_score: hs.SPACE_INVADERS ?? 0 });
    this.make_play_menu_item('SWORD ARENA', () => this.start_sword_arena(), theme, ys[i++], { high_score: this.arena_best_wave });
    this.make_play_menu_item('BLACKJACK', () => this.start_blackjack_betting(), theme, ys[i++], { high_score: hs.BLACKJACK ?? 0 });

    this.make_menu_item('< MAIN MENU', () => this.show_main_menu(), theme, 300, ys[i], 260, 56);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  // --- SNAKE mode tree ----------------------------------------------------
  show_snake_mode_select() {
    this.clear_screen();
    this.layout_menu();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_play_menu();
    this.play_sound('menu_open');

    this.draw_token_header(theme);
    this.canvas.create_text(300,90,{ text:'SNAKE', fill:theme.text, font:['Helvetica Neue',30] });
    this.canvas.create_text(300,122,{ text:'CHOOSE YOUR MODE', fill:theme.muted, font:['Helvetica Neue',12] });

    this.build_mode_select_box(155, this.vmid(), 250, 280, 'SNAKE',
      `Best: ${this.format_tokens(this.high_scores.SNAKE ?? 0)}`,
      (cx,cy,tag) => this.draw_snake_icon(cx, cy, [GREEN, theme.secondary], tag),
      () => this.show_snake_type_select(), theme);

    this.build_mode_select_box(445, this.vmid(), 250, 280, 'ESOTERIC\nSNAKE', '100 tokens/play',
      (cx,cy,tag) => this.draw_level_icon(cx, cy, 'esoteric_snake', tag, 4),
      () => this.start_esoteric_snake_warning(), theme, true);

    this.make_menu_item('< GAME MENU', () => this.show_play_menu(), theme, 300, this.canvas.VH - 80, 260, 56);
    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  show_snake_type_select() {
    this.clear_screen();
    this.layout_menu();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    const back = this.unlocked_levels.includes('esoteric_snake')
      ? () => this.show_snake_mode_select() : () => this.show_play_menu();
    this.esc_back_command = back;
    this.play_sound('menu_open');

    this.draw_token_header(theme);
    this.canvas.create_text(300,90,{ text:'SNAKE', fill:theme.text, font:['Helvetica Neue',30] });
    this.canvas.create_text(300,122,{ text:'CHOOSE YOUR STYLE', fill:theme.muted, font:['Helvetica Neue',12] });

    this.build_mode_select_box(155, this.vmid(), 250, 280, 'INFINITE',
      `Best: ${this.format_tokens(this.high_scores.SNAKE ?? 0)}`,
      (cx,cy,tag) => this.draw_snake_icon(cx, cy, [GREEN, theme.secondary], tag),
      () => this.start_snake(), theme);

    this.build_mode_select_box(445, this.vmid(), 250, 280, 'LEVELS',
      `Progress: ${this.snake_level_progress}/99`,
      (cx,cy,tag) => this.canvas.create_text(cx-18, cy, { text:'1-99', fill:theme.accent, font:['Impact',18], tags:[tag] }),
      () => this.show_snake_level_select(), theme, true);

    this.make_menu_item('< BACK', back, theme, 300, this.canvas.VH - 80, 260, 56);
    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  draw_snake_level_slider(theme, cy) {
    const mk = (tag, x1, x2, tx, glyph, delta) => {
      this.rounded_rect(x1, cy-30, x2, cy+30, 14,
        { fill:theme.bg, outline:theme.muted, width:1, tags:[tag] });
      this.canvas.create_text(tx, cy, { text:glyph, fill:theme.accent, font:['Arial',20,'bold'], tags:[tag] });
      const cmd = () => this.adjust_snake_level_selection(delta);
      const idx = this.menu_items.length;
      this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx:tx, cy, w:50, h:60, command:cmd, role:'snake_lvl_slider' });
    };
    mk('snake_lvl_left', 195, 245, 220, '◀', -1);
    mk('snake_lvl_right', 355, 405, 380, '▶', 1);
    this.canvas.create_text(300, cy, { text:String(this.snake_level_selected), fill:YELLOW, font:['Impact',40] });
  },

  adjust_snake_level_selection(delta) {
    this.snake_level_selected = Math.max(1,
      Math.min(this.snake_level_progress, this.snake_level_selected + delta));
    this.show_snake_level_select();
    // The rebuild resets selection to 0 — put it back on the arrow just
    // pressed so repeated taps keep working without re-selecting it first.
    const target = delta > 0 ? 380 : 220;
    const i = this.menu_items.findIndex(it => it.role === 'snake_lvl_slider' && Math.abs(it.cx - target) < 1);
    if (i >= 0) { this.menu_selected_index = i; this.refresh_menu_highlight(); }
  },

  show_snake_level_select() {
    this.clear_screen();
    this.layout_menu();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_snake_type_select();
    this.play_sound('menu_open');

    this.snake_level_selected = Math.max(1, Math.min(this.snake_level_progress, this.snake_level_selected));

    this.draw_token_header(theme);
    this.canvas.create_text(300,75,{ text:'SNAKE LEVELS', fill:theme.text, font:['Helvetica Neue',24] });
    const hearts = Array.from({length:3}, (_,i) => i < this.snake_level_lives ? '♥' : '♡').join('');
    this.canvas.create_text(300,102,{ text:`Progress: ${this.snake_level_progress}/99   |   Lives: ${hearts}`,
      fill:theme.muted, font:['Helvetica Neue',12] });

    this.draw_snake_level_slider(theme, 165);

    const obstacles = this.generate_level_obstacles(this.snake_level_selected);
    const mult = this.get_level_coin_multiplier(this.snake_level_selected);
    this.canvas.create_text(300,213,{ text:`Obstacles: ${obstacles.size}   |   Coin payout: ${mult.toFixed(1)}x`,
      fill:theme.muted, font:['Arial',11] });
    this.canvas.create_text(300,231,{ text:'Collect 6 apples to clear the level — tokens pay out only on completion',
      fill:theme.muted, font:['Arial',9,'italic'] });

    this.canvas.create_text(300,258,{ text:'LEVEL REWARDS', fill:theme.accent, font:['Helvetica Neue',11,'bold'] });
    this.canvas.create_text(300,278,{ text:'Every 5 levels: level × 100 bonus TOKENS', fill:YELLOW, font:['Arial',10,'bold'] });
    this.canvas.create_text(300,296,{ text:'Every 10 levels: +100 ENERGY', fill:PURPLE, font:['Arial',10,'bold'] });
    this.canvas.create_text(300,318,{ text:'LEVEL 99: +100,000 TOKENS + 10,000 ENERGY', fill:'#f59e0b', font:['Arial',10,'bold'] });

    this.make_menu_item(`PLAY LEVEL ${this.snake_level_selected}`,
      () => this.start_snake_level(this.snake_level_selected), theme, 300, 390, 240, 44);
    this.make_menu_item('< BACK', () => this.show_snake_type_select(), theme, 300, 450, 200, 36);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  // --- FLAPPY mode tree ---------------------------------------------------
  show_flappy_mode_select() {
    this.clear_screen();
    this.layout_menu();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_play_menu();
    this.play_sound('menu_open');

    this.draw_token_header(theme);
    this.canvas.create_text(300,90,{ text:'FLAPPY BIRD', fill:theme.text, font:['Helvetica Neue',28] });
    this.canvas.create_text(300,122,{ text:'CHOOSE YOUR MODE', fill:theme.muted, font:['Helvetica Neue',12] });

    this.build_mode_select_box(155, this.vmid(), 250, 280, 'FLAPPY BIRD',
      `Best: ${this.format_tokens(this.high_scores.FLAPPY ?? 0)}`,
      (cx,cy,tag) => this.draw_flappy_icon(cx, cy, [YELLOW], tag),
      () => this.start_flappy(), theme);

    this.build_mode_select_box(445, this.vmid(), 250, 280, 'ALT\nDIMENSION',
      `Best: ${this.format_tokens(this.high_scores.ALT_DIMENSION ?? 0)}`,
      (cx,cy,tag) => this.draw_level_icon(cx, cy, 'flappy_alt_dimension', tag, 4),
      () => this.start_alt_dimension(), theme, true);

    this.make_menu_item('< GAME MENU', () => this.show_play_menu(), theme, 300, this.canvas.VH - 80, 260, 56);
    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },
});

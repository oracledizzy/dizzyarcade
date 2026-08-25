// other.js — the credits screen, its hidden cheat star, and the cheat menu.

Object.assign(ArcadeApp.prototype, {

  compute_star_points(cx, cy, outer_r, inner_r, points=5) {
    const coords = [];
    let angle = -Math.PI/2;
    const step = Math.PI/points;
    for (let i = 0; i < points*2; i++) {
      const r = i % 2 === 0 ? outer_r : inner_r;
      coords.push(cx + r*Math.cos(angle), cy + r*Math.sin(angle));
      angle += step;
    }
    return coords;
  },

  // Deliberately NOT added to menu_items, so keyboard/controller navigation
  // can never land on it — it stays a pointer-only secret.
  draw_cheat_star(theme) {
    const pts = this.compute_star_points(572, 576, 14, 6);
    this.canvas.create_polygon(pts, { fill:theme.muted, outline:'', tags:['cheat_star'] });
    this.canvas.tag_bind('cheat_star', '<Button-1>', () => this.handle_click(() => this.open_cheat_password_prompt()));
  },

  show_other_screen() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_main_menu();
    this.play_sound('menu_open');
    this.play_music('sound/starwars_music.m4a');

    if (!this.inverted)
      for (let i = 0; i < 60; i++) {
        const sx = Math.floor(Math.random()*601), sy = Math.floor(Math.random()*601);
        this.canvas.create_oval(sx, sy, sx+2, sy+2, { fill:WHITE, outline:'' });
      }

    this.canvas.create_text(300,180,{ text:'A LONG TIME AGO IN A\nSTUDIO FAR, FAR AWAY...',
      fill: this.inverted ? theme.primary : BLUE, font:['Arial',14,'bold'] });
    this.canvas.create_text(300,300,{ text:'THIS WAS MADE BY DIZZY',
      fill:theme.accent, font:['Impact',32,'bold'] });

    this.make_menu_item('< MAIN MENU', () => this.show_main_menu(), theme, 300, 460, 200);
    this.draw_cheat_star(theme);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  open_cheat_password_prompt() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_other_screen();
    this.play_sound('menu_open');

    this.canvas.create_text(300,190,{ text:'ENTER CHEAT PASSWORD', fill:theme.text, font:['Helvetica Neue',20,'bold'] });
    this.cheat_pw_input = this.canvas.create_input(300, 250, 260, 32, { password:true, focus:true });
    this.cheat_pw_input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.submit_cheat_password(); }
    });

    this.make_menu_item('SUBMIT', () => this.submit_cheat_password(), theme, 300, 310, 160, 40);
    this.make_menu_item('< BACK', () => this.show_other_screen(), theme, 300, 370, 160, 40);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  submit_cheat_password() {
    const pw = this.cheat_pw_input ? this.cheat_pw_input.value : '';
    if (pw === 'worksmarternotharder') { this.show_cheat_menu(); return; }
    this.canvas.delete('cheat_pw_error');
    this.canvas.create_text(300,420,{ text:'INCORRECT PASSWORD', fill:RED, font:['Arial',12,'bold'], tags:['cheat_pw_error'] });
  },

  show_cheat_menu() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_other_screen();
    this.play_sound('menu_open');

    this.draw_token_header(theme);
    this.canvas.create_text(300,90,{ text:'CHEAT MENU', fill:RED, font:['Helvetica Neue',26,'bold'] });

    this.canvas.create_text(300,140,{ text:'TOKEN GENERATOR', fill:theme.accent, font:['Helvetica Neue',13,'bold'] });
    this.cheat_token_input = this.canvas.create_input(300, 175, 180, 32, { inputmode:'numeric', focus:true });
    this.make_menu_item('GENERATE TOKENS', () => this.cheat_generate_tokens(), theme, 300, 220, 230, 40);

    this.canvas.create_text(300,270,{ text:'ENERGY GENERATOR', fill:PURPLE, font:['Helvetica Neue',13,'bold'] });
    this.cheat_energy_input = this.canvas.create_input(300, 305, 180, 32, { inputmode:'numeric' });
    this.make_menu_item('GENERATE ENERGY', () => this.cheat_generate_energy(), theme, 300, 350, 230, 40);

    const matrix_unlocked = this.unlocked_themes.includes('matrix');
    const matrix_label = matrix_unlocked && this.theme_hue === 'matrix' ? 'MATRIX THEME: ACTIVE'
      : matrix_unlocked ? 'MATRIX THEME: UNLOCKED (APPLY)' : 'UNLOCK MATRIX THEME';
    this.make_menu_item(matrix_label, () => this.cheat_unlock_matrix_theme(), theme, 300, 405, 280, 40);

    const levels_label = this.snake_level_progress >= 99 ? 'ALL SNAKE LEVELS: UNLOCKED' : 'UNLOCK ALL SNAKE LEVELS';
    this.make_menu_item(levels_label, () => this.cheat_unlock_all_snake_levels(), theme, 300, 455, 280, 40);

    this.make_menu_item('< OTHER MENU', () => this.show_other_screen(), theme, 300, 520, 200, 38);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  cheat_generate_tokens() {
    const amount = parseInt((this.cheat_token_input?.value ?? '').trim(), 10);
    if (Number.isFinite(amount) && amount !== 0) {
      this.tokens = Math.max(0, this.tokens + amount);
      this.saveHighScores();
    }
    this.show_cheat_menu();
  },

  cheat_generate_energy() {
    const amount = parseInt((this.cheat_energy_input?.value ?? '').trim(), 10);
    if (Number.isFinite(amount) && amount !== 0) {
      this.energy = Math.max(0, this.energy + amount);
      this.saveHighScores();
    }
    this.show_cheat_menu();
  },

  // Unlocking applies the theme immediately and makes it selectable in
  // Settings from then on, exactly like any store-bought theme.
  cheat_unlock_matrix_theme() {
    if (!this.unlocked_themes.includes('matrix')) this.unlocked_themes.push('matrix');
    this.theme_hue = 'matrix';
    this.saveHighScores();
    this.show_cheat_menu();
  },

  // Makes every level selectable. Deliberately does NOT grant the milestone
  // or level-99 rewards — those are only earned by actually playing.
  cheat_unlock_all_snake_levels() {
    this.snake_level_progress = 99;
    this.saveHighScores();
    this.show_cheat_menu();
  },
});

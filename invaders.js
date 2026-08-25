// invaders.js — Space Invaders.
//
// On desktop the ship moved with held arrow keys and fired on Space. On a
// phone the ship tracks your finger horizontally and fires automatically on
// the same cooldown, so the whole game needs one thumb instead of three keys.

Object.assign(ArcadeApp.prototype, {

  spawn_enemy_wave(wave) {
    const enemies = [];
    for (let r = 0; r < SI_ENEMY_ROWS; r++)
      for (let c = 0; c < SI_ENEMY_COLS; c++)
        enemies.push({ x: SI_ENEMY_START_X + c*SI_ENEMY_GAP_X,
                       y: SI_ENEMY_START_Y + r*SI_ENEMY_GAP_Y, row:r, alive:true });
    return enemies;
  },

  // Three degradable blocks, each a 5x2 grid of cells that vanish individually.
  spawn_shields() {
    const cells = [];
    for (const cx of [150, 300, 450])
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 5; col++)
          cells.push({ x: cx - 20 + col*10, y: 480 + row*8, alive:true });
    return cells;
  },

  start_space_invaders() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_music('sound/snake_music.m4a');

    this.game_type = 'SPACE_INVADERS';
    this.game_running = true;
    this.score = 0;
    this.session_tokens_earned = 0;

    this.si_lives = 3;
    this.si_wave = 1;
    this.si_ship_x = 300;
    this.si_ship_y = 560;
    this.si_ship_w = 34;
    this.si_ship_h = 18;
    this.si_ship_speed = 7;
    this.si_shoot_cooldown = 0;

    this.si_player_bullets = [];
    this.si_enemy_bullets = [];
    this.si_falling_coins = [];

    this.si_enemy_dir = 1;
    this.si_enemy_speed = 1.2;
    this.si_enemies = this.spawn_enemy_wave(this.si_wave);
    this.si_shields = this.spawn_shields();

    this.si_ufo = null;
    this.si_ufo_timer = 400 + Math.floor(Math.random()*301);

    this.setDragHandler(p => { this.si_ship_x = Math.max(30, Math.min(570, p.x)); });
    this.onKey = k => {
      if (k === 'Escape') { this.quit_to_menu(); return true; }
      return false;
    };
    this.esc_back_command = () => this.quit_to_menu();

    this.run_space_invaders_loop();
  },

  run_space_invaders_loop() {
    if (!this.game_running) return;
    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });

    const P = this.pressed;
    if (P.has('ArrowLeft') || P.has('a') || P.has('A'))
      this.si_ship_x = Math.max(30, this.si_ship_x - this.si_ship_speed);
    if (P.has('ArrowRight') || P.has('d') || P.has('D'))
      this.si_ship_x = Math.min(570, this.si_ship_x + this.si_ship_speed);

    if (this.si_shoot_cooldown > 0) this.si_shoot_cooldown--;
    if (this.si_shoot_cooldown <= 0) {
      this.si_player_bullets.push({ x:this.si_ship_x, y:this.si_ship_y - 12 });
      this.si_shoot_cooldown = 12;
      this.play_sound('pew');
    }

    this.si_player_bullets = this.si_player_bullets.filter(b => { b.y -= 10; return b.y >= 55; });

    let alive = this.si_enemies.filter(e => e.alive);
    if (alive.length) {
      for (const e of alive) e.x += this.si_enemy_dir * this.si_enemy_speed;
      const minX = Math.min(...alive.map(e => e.x));
      const maxX = Math.max(...alive.map(e => e.x + SI_ENEMY_W));
      if (minX <= 20 || maxX >= 580) {
        this.si_enemy_dir *= -1;
        for (const e of alive) e.y += 16;
      }
    } else {
      this.si_wave++;
      const bonus = 100 * this.si_wave;
      this.session_tokens_earned += bonus;
      this.add_tokens(bonus);
      this.play_sound('fanfare');
      this.si_enemy_speed = Math.min(4.0, 1.2 + (this.si_wave-1)*0.3);
      this.si_enemies = this.spawn_enemy_wave(this.si_wave);
      alive = this.si_enemies.filter(e => e.alive);
      this.si_enemy_dir = 1;
      this.si_player_bullets = [];
      this.si_enemy_bullets = [];
    }

    const fire_chance = 0.01 + 0.003*this.si_wave;
    if (alive.length && Math.random() < fire_chance) {
      const s = alive[Math.floor(Math.random()*alive.length)];
      this.si_enemy_bullets.push({ x: s.x + SI_ENEMY_W/2, y: s.y + SI_ENEMY_H });
    }
    this.si_enemy_bullets = this.si_enemy_bullets.filter(b => { b.y += 6; return b.y <= 600; });

    if (!this.si_ufo) {
      if (--this.si_ufo_timer <= 0) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.si_ufo = { x: dir === 1 ? -30 : 630, dir };
        this.si_ufo_timer = 500 + Math.floor(Math.random()*301);
      }
    } else {
      this.si_ufo.x += this.si_ufo.dir * 3;
      if (this.si_ufo.x < -40 || this.si_ufo.x > 640) this.si_ufo = null;
    }

    this.si_falling_coins = this.si_falling_coins.filter(c => { c.y += 3; return c.y <= 600; });

    // player bullets vs shields
    this.si_player_bullets = this.si_player_bullets.filter(b => {
      const cell = this.si_shields.find(s => s.alive && Math.abs(b.x-s.x) < 6 && Math.abs(b.y-s.y) < 5);
      if (cell) { cell.alive = false; this.play_sound('block_hit'); return false; }
      return true;
    });

    // player bullets vs enemies
    this.si_player_bullets = this.si_player_bullets.filter(b => {
      const e = alive.find(e => e.alive &&
        Math.abs(b.x - (e.x + SI_ENEMY_W/2)) < SI_ENEMY_W/2 &&
        Math.abs(b.y - (e.y + SI_ENEMY_H/2)) < SI_ENEMY_H/2);
      if (!e) return true;
      e.alive = false;
      this.score += SI_ROW_POINTS[e.row] ?? 10;
      if (Math.random() < 0.25) {
        const roll = Math.random();
        let val;
        if (roll < 0.70)      val = 1 + Math.floor(Math.random()*10);
        else if (roll < 0.90) val = 25 + Math.floor(Math.random()*26);
        else                  val = 100 + Math.floor(Math.random()*151);
        this.si_falling_coins.push({ x: e.x + SI_ENEMY_W/2, y: e.y, val });
      }
      return false;
    });

    // player bullets vs UFO
    if (this.si_ufo) {
      this.si_player_bullets = this.si_player_bullets.filter(b => {
        if (Math.abs(b.x - this.si_ufo.x) >= 20 || Math.abs(b.y - 75) >= 15) return true;
        const bonus = [50,100,150,300][Math.floor(Math.random()*4)];
        this.score += 100;
        this.session_tokens_earned += bonus;
        this.add_tokens(bonus);
        this.play_sound('fanfare');
        this.si_ufo = null;
        return false;
      });
    }

    // enemy bullets vs shields
    this.si_enemy_bullets = this.si_enemy_bullets.filter(b => {
      const cell = this.si_shields.find(s => s.alive && Math.abs(b.x-s.x) < 6 && Math.abs(b.y-s.y) < 5);
      if (cell) { cell.alive = false; this.play_sound('block_hit'); return false; }
      return true;
    });

    // enemy bullets vs ship
    for (const b of [...this.si_enemy_bullets]) {
      if (Math.abs(b.x - this.si_ship_x) < this.si_ship_w/2 + 4 &&
          Math.abs(b.y - this.si_ship_y) < this.si_ship_h/2 + 6) {
        this.si_enemy_bullets.splice(this.si_enemy_bullets.indexOf(b), 1);
        this.si_lives--;
        this.play_sound('lose');
        if (this.si_lives <= 0) { this.finish_space_invaders('SHOT DOWN!'); return; }
      }
    }

    // falling coins vs ship
    this.si_falling_coins = this.si_falling_coins.filter(c => {
      if (Math.abs(c.x - this.si_ship_x) < this.si_ship_w/2 + 8 &&
          Math.abs(c.y - this.si_ship_y) < this.si_ship_h/2 + 8) {
        this.session_tokens_earned += c.val;
        this.play_sound('coin');
        return false;
      }
      return true;
    });

    for (const e of alive)
      if (e.y + SI_ENEMY_H >= this.si_ship_y - 10) { this.finish_space_invaders('INVADED!'); return; }

    // --- draw ---
    this.canvas.create_rectangle(0,0,600,50,{ fill:theme.primary, outline:'' });
    this.canvas.create_text(70,20,{ text:`Score: ${this.score}`, fill:WHITE, font:['Arial',13,'bold'] });
    this.canvas.create_text(210,20,{ text:`Wave: ${this.si_wave}`, fill:YELLOW, font:['Arial',12,'bold'] });
    this.canvas.create_text(340,20,{ text:`Lives: ${this.si_lives}`, fill:RED, font:['Arial',12,'bold'] });
    this.canvas.create_text(470,20,{ text:`+${this.session_tokens_earned}`, fill:YELLOW, font:['Arial',11,'bold'] });
    this.canvas.create_text(300,40,{ text:'DRAG TO MOVE — FIRES AUTOMATICALLY', fill:WHITE, font:['Arial',8] });

    for (const c of this.si_shields)
      if (c.alive) this.canvas.create_rectangle(c.x-5, c.y-4, c.x+5, c.y+4, { fill:GREEN, outline:'' });

    for (const e of alive) this.draw_invader_icon(e.x + SI_ENEMY_W/2, e.y + SI_ENEMY_H/2, e.row);

    if (this.si_ufo) {
      this.canvas.create_oval(this.si_ufo.x-18, 65, this.si_ufo.x+18, 85, { fill:'#ff2fb0', outline:WHITE, width:1 });
      this.canvas.create_text(this.si_ufo.x, 75, { text:'$', fill:WHITE, font:['Arial',10,'bold'] });
    }

    const bc = this.get_active_si_bullet_color();
    for (const b of this.si_player_bullets)
      this.canvas.create_rectangle(b.x-2, b.y-6, b.x+2, b.y+6, { fill:bc, outline:'' });
    for (const b of this.si_enemy_bullets)
      this.canvas.create_rectangle(b.x-2, b.y-6, b.x+2, b.y+6, { fill:RED, outline:'' });

    for (const c of this.si_falling_coins) {
      this.canvas.create_oval(c.x-7, c.y-7, c.x+7, c.y+7, { fill:YELLOW, outline:WHITE, width:1 });
      this.canvas.create_text(c.x, c.y, { text:'$', fill:BLACK, font:['Arial',8,'bold'] });
    }

    this.draw_ship(this.si_ship_x, this.si_ship_y, theme);
    this.drawQuitButton(theme);
    this.game_job = setTimeout(() => this.run_space_invaders_loop(), 30);
  },

  draw_ship(cx, cy, theme) {
    const color = this.get_active_si_ship_color() || theme.accent;
    this.draw_si_ship_icon(cx, cy, color, null, null, this.si_ship_w, this.si_ship_h);
  },

  finish_space_invaders(message) {
    if (this.session_tokens_earned > 0) this.add_tokens(this.session_tokens_earned);
    this.end_game(message);
  },
});

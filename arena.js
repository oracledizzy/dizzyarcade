// arena.js — Sword Arena: ten waves across two maps, with a loot phase.
//
// On desktop this was WASD plus Space. On a phone the left half of the screen
// becomes a virtual joystick that appears wherever your thumb lands, and the
// bottom-right corner is a held attack button — the sword auto-swings while
// it is pressed and its cooldown allows.

Object.assign(ArcadeApp.prototype, {

  start_sword_arena() {
    this.clear_screen();
    this.layout_game();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_music('sound/snake_music.m4a');

    this.game_type = 'SWORD_ARENA';
    this.game_running = true;

    this.arena_px = 300; this.arena_py = 330;
    this.arena_max_hp = 100 + this.arena_bonus_hp;
    this.arena_hp = this.arena_max_hp;
    this.arena_speed = 4.5 + this.arena_bonus_speed * 0.3;
    this.arena_sword_cooldown = 0;
    this.arena_sword_cooldown_max = Math.max(10, 26 - this.arena_bonus_sword * 2);
    this.arena_swing_anim = 0;
    this.arena_facing = [0, -1];

    this.arena_wave = 1;
    this.arena_map_index = 0;
    this.arena_enemies = [];
    this.arena_bullets = [];
    this.arena_bombs = [];
    this.arena_loot = [];
    this.arena_stun_ticks = 0;

    this.arena_run_tokens = 0;
    this.arena_run_energy = 0;
    this.arena_run_hearts = 0;
    this.arena_run_powerups = [];
    // Arena tracks earnings in arena_run_tokens; zero the generic counter so
    // a quit never re-awards a stale amount from a previous game.
    this.session_tokens_earned = 0;

    this.setArenaTouch();
    this.onKey = k => {
      if (k === 'Escape') { this.quit_to_menu(); return true; }
      return false;
    };
    this.esc_back_command = () => this.quit_to_menu();

    this.spawn_arena_wave(this.arena_wave);
    this.run_arena_combat_loop();
  },

  // --- touch controls -----------------------------------------------------
  setArenaTouch() {
    this.clearArenaTouch();
    const el = this.canvas.el;
    this.arena_stick = null;          // {ox, oy, dx, dy} while a thumb is down
    this.arena_attack_held = false;
    const sticks = new Map();         // pointerId -> 'move' | 'attack'

    const inAttack = p => p.x > 440 && p.y > 440;

    const down = e => {
      const p = this.canvas.toVirtual(e.clientX, e.clientY);
      el.setPointerCapture?.(e.pointerId);
      if (inAttack(p)) {
        sticks.set(e.pointerId, 'attack');
        this.arena_attack_held = true;
      } else {
        sticks.set(e.pointerId, 'move');
        this.arena_stick = { ox:p.x, oy:p.y, dx:0, dy:0 };
      }
    };
    const move = e => {
      if (sticks.get(e.pointerId) !== 'move' || !this.arena_stick) return;
      const p = this.canvas.toVirtual(e.clientX, e.clientY);
      let dx = p.x - this.arena_stick.ox, dy = p.y - this.arena_stick.oy;
      const len = Math.hypot(dx, dy);
      const DEAD = 8, MAX = 55;
      if (len < DEAD) { this.arena_stick.dx = 0; this.arena_stick.dy = 0; return; }
      const clamped = Math.min(len, MAX);
      this.arena_stick.dx = (dx/len) * (clamped/MAX);
      this.arena_stick.dy = (dy/len) * (clamped/MAX);
    };
    const up = e => {
      const role = sticks.get(e.pointerId);
      sticks.delete(e.pointerId);
      if (role === 'attack') this.arena_attack_held = false;
      if (role === 'move') this.arena_stick = null;
    };

    this._arena = { down, move, up };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  },

  clearArenaTouch() {
    if (!this._arena) return;
    const el = this.canvas.el;
    el.removeEventListener('pointerdown', this._arena.down);
    el.removeEventListener('pointermove', this._arena.move);
    el.removeEventListener('pointerup', this._arena.up);
    el.removeEventListener('pointercancel', this._arena.up);
    this._arena = null;
    this.arena_stick = null;
    this.arena_attack_held = false;
  },

  // Combines held keys and the virtual stick into one movement vector.
  read_arena_input() {
    let dx = 0, dy = 0;
    const P = this.pressed;
    if (P.has('ArrowLeft')  || P.has('a') || P.has('A')) dx -= 1;
    if (P.has('ArrowRight') || P.has('d') || P.has('D')) dx += 1;
    if (P.has('ArrowUp')    || P.has('w') || P.has('W')) dy -= 1;
    if (P.has('ArrowDown')  || P.has('s') || P.has('S')) dy += 1;
    if (!dx && !dy && this.arena_stick) { dx = this.arena_stick.dx; dy = this.arena_stick.dy; }
    return [dx, dy];
  },

  // --- waves --------------------------------------------------------------
  spawn_arena_wave(wave_num) {
    const [sw, sh, bo] = ARENA_WAVE_COMPOSITION[Math.min(wave_num, ARENA_WAVE_COMPOSITION.length) - 1];
    const enemies = [];
    for (let i=0;i<sw;i++) enemies.push(this.spawn_arena_enemy('swordsman'));
    for (let i=0;i<sh;i++) enemies.push(this.spawn_arena_enemy('shooter'));
    for (let i=0;i<bo;i++) enemies.push(this.spawn_arena_enemy('bomber'));
    this.arena_enemies = enemies;
  },

  spawn_arena_enemy(etype) {
    let x = 0, y = 0, attempts = 0;
    while (attempts < 40) {
      x = 40 + Math.floor(Math.random()*521);
      y = 90 + Math.floor(Math.random()*481);
      if (Math.hypot(x - this.arena_px, y - this.arena_py) > 150) break;
      attempts++;
    }
    const hp = etype === 'bomber' ? Math.max(1, 3 - this.arena_bonus_damage) : 1;
    return { type:etype, x, y, hp,
      hit_cooldown:0,
      bomb_cooldown: 60 + Math.floor(Math.random()*61),
      shoot_cooldown: 30 + Math.floor(Math.random()*41),
      wander_angle: Math.random()*Math.PI*2,
      wander_timer: 20 + Math.floor(Math.random()*41) };
  },

  get_arena_drop(etype) {
    const roll = Math.random();
    const ri = (a,b) => a + Math.floor(Math.random()*(b-a+1));
    if (etype === 'swordsman') {
      if (roll < 0.65) return ['coin', ri(5,15)];
      if (roll < 0.90) return ['energy', ri(1,3)];
      return ['heart', 1];
    }
    if (etype === 'shooter') {
      if (roll < 0.55) return ['energy', ri(2,5)];
      if (roll < 0.85) return ['coin', ri(5,15)];
      return ['heart', 1];
    }
    if (roll < 0.35) return ['coin', ri(20,40)];
    if (roll < 0.65) return ['energy', ri(5,10)];
    if (roll < 0.85) return ['heart', 1];
    return ['powerup', 1];
  },

  // --- combat -------------------------------------------------------------
  run_arena_combat_loop() {
    if (!this.game_running) return;
    const theme = this.get_theme();
    this.canvas.delete('all');
    const map_theme = ARENA_MAP_THEMES[this.arena_map_index];
    this.canvas.configure({ bg: map_theme.bg });

    let speed = this.arena_speed;
    if (this.arena_stun_ticks > 0) { speed *= 0.4; this.arena_stun_ticks--; }

    let [dx, dy] = this.read_arena_input();
    if (dx || dy) {
      const norm = Math.hypot(dx, dy) || 1;
      dx /= norm; dy /= norm;
      this.arena_facing = [dx, dy];
      this.arena_px = Math.max(30, Math.min(570, this.arena_px + dx*speed));
      this.arena_py = Math.max(80, Math.min(590, this.arena_py + dy*speed));
    }

    if (this.arena_sword_cooldown > 0) this.arena_sword_cooldown--;
    if (this.arena_swing_anim > 0) this.arena_swing_anim--;

    const swinging = this.pressed.has(' ') || this.arena_attack_held;
    if (swinging && this.arena_sword_cooldown <= 0) {
      this.arena_sword_cooldown = this.arena_sword_cooldown_max;
      this.arena_swing_anim = ARENA_SWING_TICKS;
      this.play_sound('pew');
      for (const enemy of [...this.arena_enemies]) {
        if (Math.hypot(enemy.x - this.arena_px, enemy.y - this.arena_py) <= 55) {
          if (--enemy.hp <= 0) {
            this.arena_enemies.splice(this.arena_enemies.indexOf(enemy), 1);
            const [type, value] = this.get_arena_drop(enemy.type);
            this.arena_loot.push({ x:enemy.x, y:enemy.y, type, value });
            this.play_sound('eat');
          }
        }
      }
    }

    for (const enemy of [...this.arena_enemies]) {
      const ex = enemy.x, ey = enemy.y;
      const ddist = Math.hypot(this.arena_px - ex, this.arena_py - ey) || 1;

      if (enemy.type === 'swordsman') {
        const spd = 3.3;
        enemy.x += (this.arena_px - ex)/ddist * spd;
        enemy.y += (this.arena_py - ey)/ddist * spd;
        if (enemy.hit_cooldown > 0) enemy.hit_cooldown--;
        if (ddist < 26 && enemy.hit_cooldown <= 0) {
          this.arena_hp -= 12;
          enemy.hit_cooldown = 20;
          this.play_sound('lose');
        }
      } else if (enemy.type === 'shooter') {
        const spd = 2.4;
        if (ddist < 260) {
          // Flee, but blend a pull toward the centre so they don't wedge
          // themselves into a corner.
          const fx = -(this.arena_px - ex)/ddist, fy = -(this.arena_py - ey)/ddist;
          let ccx = 300 - ex, ccy = 330 - ey;
          const cdist = Math.hypot(ccx, ccy) || 1;
          ccx /= cdist; ccy /= cdist;
          const mx = fx*0.75 + ccx*0.25, my = fy*0.75 + ccy*0.25;
          const mnorm = Math.hypot(mx, my) || 1;
          enemy.x = Math.max(50, Math.min(550, enemy.x + mx/mnorm*spd));
          enemy.y = Math.max(95, Math.min(575, enemy.y + my/mnorm*spd));
          enemy.wander_timer = 20 + Math.floor(Math.random()*31);
        } else {
          if (--enemy.wander_timer <= 0) {
            enemy.wander_angle = Math.random()*Math.PI*2;
            enemy.wander_timer = 30 + Math.floor(Math.random()*41);
          }
          enemy.x = Math.max(50, Math.min(550, enemy.x + Math.cos(enemy.wander_angle)*1.8));
          enemy.y = Math.max(95, Math.min(575, enemy.y + Math.sin(enemy.wander_angle)*1.8));
        }
        if (--enemy.shoot_cooldown <= 0) {
          this.arena_bullets.push({ x:ex, y:ey,
            dx:(this.arena_px - ex)/ddist, dy:(this.arena_py - ey)/ddist });
          enemy.shoot_cooldown = 70 + Math.floor(Math.random()*41);
        }
      } else {
        const spd = 1.6;
        if (ddist > 140) {
          enemy.x += (this.arena_px - ex)/ddist * spd;
          enemy.y += (this.arena_py - ey)/ddist * spd;
        } else {
          if (--enemy.wander_timer <= 0) {
            enemy.wander_angle = Math.random()*Math.PI*2;
            enemy.wander_timer = 25 + Math.floor(Math.random()*31);
          }
          enemy.x = Math.max(50, Math.min(550, enemy.x + Math.cos(enemy.wander_angle)*spd));
          enemy.y = Math.max(95, Math.min(575, enemy.y + Math.sin(enemy.wander_angle)*spd));
        }
        if (--enemy.bomb_cooldown <= 0) {
          this.arena_bombs.push({ x:this.arena_px, y:this.arena_py, timer:100,
            type: Math.random() < 0.5 ? 'stun' : 'explosion', radius:45 });
          enemy.bomb_cooldown = 110 + Math.floor(Math.random()*51);
        }
      }
    }

    for (const b of [...this.arena_bullets]) {
      b.x += b.dx*6; b.y += b.dy*6;
      if (b.x < 0 || b.x > 600 || b.y < 55 || b.y > 600) {
        this.arena_bullets.splice(this.arena_bullets.indexOf(b),1); continue;
      }
      if (Math.hypot(b.x - this.arena_px, b.y - this.arena_py) < 16) {
        this.arena_hp -= 10;
        this.arena_bullets.splice(this.arena_bullets.indexOf(b),1);
        this.play_sound('lose');
      }
    }

    // Bombs telegraph for ~3s (100 ticks at 30ms) before resolving.
    for (const bomb of [...this.arena_bombs]) {
      if (--bomb.timer <= 0) {
        if (Math.hypot(bomb.x - this.arena_px, bomb.y - this.arena_py) <= bomb.radius) {
          if (bomb.type === 'explosion') this.arena_hp -= 25;
          else this.arena_stun_ticks = 166;
          this.play_sound('block_hit');
        }
        this.arena_bombs.splice(this.arena_bombs.indexOf(bomb),1);
      }
    }

    if (this.arena_hp <= 0) { this.finish_arena_death(); return; }

    if (!this.arena_enemies.length && !this.arena_bullets.length && !this.arena_bombs.length) {
      if (this.arena_wave % 5 === 0) { this.start_arena_collection_phase(); return; }
      this.arena_wave++;
      this.spawn_arena_wave(this.arena_wave);
    }

    // --- HUD ---
    this.canvas.create_rectangle(0,0,600,55,{ fill:theme.primary, outline:'' });
    const hp_pct = Math.max(0, this.arena_hp / this.arena_max_hp);
    this.canvas.create_rectangle(15,15,215,30,{ outline:WHITE, width:1, fill:'' });
    this.canvas.create_rectangle(15,15,15+200*hp_pct,30,{ fill: hp_pct > 0.3 ? RED : '#7f1d1d', outline:'' });
    this.canvas.create_text(115,22,{ text:`HP ${Math.max(0,Math.round(this.arena_hp))}/${this.arena_max_hp}`, fill:WHITE, font:['Arial',9,'bold'] });
    this.canvas.create_text(300,22,{ text:`WAVE ${this.arena_wave}/10`, fill:WHITE, font:['Arial',12,'bold'] });
    const sword_pct = 1 - (this.arena_sword_cooldown / this.arena_sword_cooldown_max);
    // kept left of x=505 so it never runs under the MENU chip
    this.canvas.create_rectangle(390,15,490,30,{ outline:WHITE, width:1, fill:'' });
    this.canvas.create_rectangle(390,15,390+100*sword_pct,30,{ fill: sword_pct >= 1 ? YELLOW : theme.muted, outline:'' });
    this.canvas.create_text(440,22,{ text:'SWORD', fill: sword_pct >= 1 ? BLACK : WHITE, font:['Arial',8,'bold'] });
    if (this.arena_stun_ticks > 0)
      this.canvas.create_text(300,42,{ text:'STUNNED!', fill:'#c084fc', font:['Arial',11,'bold'] });

    for (const item of this.arena_loot)
      this.canvas.create_oval(item.x-5, item.y-5, item.x+5, item.y+5, { fill:theme.muted, outline:'' });

    for (const bomb of this.arena_bombs) this.draw_arena_bomb(bomb);
    for (const b of this.arena_bullets) this.draw_arena_bullet(b);
    for (const e of this.arena_enemies) this.draw_arena_enemy(e);
    this.draw_arena_player(theme);
    this.draw_arena_touch_ui(sword_pct);
    this.drawQuitButton(theme);

    this.game_job = setTimeout(() => this.run_arena_combat_loop(), 30);
  },

  draw_arena_touch_ui(sword_pct) {
    // Attack pad, always visible so the control is discoverable.
    const ready = sword_pct >= 1;
    this.canvas.create_oval(490, 490, 570, 570,
      { fill: ready ? 'rgba(250,204,21,0.30)' : 'rgba(255,255,255,0.10)',
        outline: ready ? YELLOW : 'rgba(255,255,255,0.35)', width:2 });
    this.canvas.create_text(530, 530, { text:'⚔', fill: ready ? YELLOW : 'rgba(255,255,255,0.5)', font:['Arial',26,'bold'] });

    if (this.arena_stick) {
      const s = this.arena_stick;
      this.canvas.create_oval(s.ox-55, s.oy-55, s.ox+55, s.oy+55,
        { outline:'rgba(255,255,255,0.30)', width:2, fill:'' });
      this.canvas.create_oval(s.ox + s.dx*55 - 18, s.oy + s.dy*55 - 18,
                              s.ox + s.dx*55 + 18, s.oy + s.dy*55 + 18,
        { fill:'rgba(255,255,255,0.35)', outline:'rgba(255,255,255,0.6)', width:2 });
    }
  },

  // --- loot phase ---------------------------------------------------------
  start_arena_collection_phase() {
    this.arena_collect_ticks_left = 500;
    this.run_arena_collection_loop();
  },

  run_arena_collection_loop() {
    if (!this.game_running) return;
    const theme = this.get_theme();
    this.canvas.delete('all');
    const map_theme = ARENA_MAP_THEMES[this.arena_map_index];
    this.canvas.configure({ bg: map_theme.bg });

    let [dx, dy] = this.read_arena_input();
    if (dx || dy) {
      const norm = Math.hypot(dx, dy) || 1;
      dx /= norm; dy /= norm;
      this.arena_facing = [dx, dy];
      this.arena_px = Math.max(30, Math.min(570, this.arena_px + dx*this.arena_speed));
      this.arena_py = Math.max(80, Math.min(590, this.arena_py + dy*this.arena_speed));
    }

    for (const item of [...this.arena_loot]) {
      if (Math.hypot(item.x - this.arena_px, item.y - this.arena_py) < 22) {
        this.collect_arena_loot(item);
        this.arena_loot.splice(this.arena_loot.indexOf(item), 1);
      }
    }

    this.arena_collect_ticks_left--;

    this.canvas.create_rectangle(0,0,600,50,{ fill:map_theme.accent, outline:'' });
    this.canvas.create_text(300,25,{ text:`COLLECT THE LOOT!  (${this.arena_loot.length} left)`, fill:BLACK, font:['Arial',13,'bold'] });

    for (const item of this.arena_loot) this.draw_arena_loot(item);
    this.draw_arena_player(theme);
    this.draw_arena_touch_ui(0);

    if (!this.arena_loot.length || this.arena_collect_ticks_left <= 0) {
      this.show_arena_summary();
      return;
    }
    this.game_job = setTimeout(() => this.run_arena_collection_loop(), 30);
  },

  collect_arena_loot(item) {
    this.play_sound('coin');
    if (item.type === 'coin') this.arena_run_tokens += item.value;
    else if (item.type === 'energy') this.arena_run_energy += item.value;
    else if (item.type === 'heart') {
      this.arena_run_hearts++;
      this.arena_hp = Math.min(this.arena_max_hp, this.arena_hp + 20);
    } else if (item.type === 'powerup') {
      const stat = ['hp','damage','speed','sword'][Math.floor(Math.random()*4)];
      this.arena_run_powerups.push(stat);
      if (stat === 'hp') this.arena_bonus_hp += 10;
      else if (stat === 'damage') this.arena_bonus_damage += 1;
      else if (stat === 'speed') this.arena_bonus_speed += 1;
      else this.arena_bonus_sword += 1;
      this.saveHighScores();
    }
  },

  show_arena_summary() {
    this.game_running = false;
    if (this.game_job) { clearTimeout(this.game_job); this.game_job = null; }
    this.clearArenaTouch();
    this.onKey = null;
    this.layout_menu();

    if (this.arena_run_tokens > 0) this.add_tokens(this.arena_run_tokens);
    if (this.arena_run_energy > 0) this.add_energy(this.arena_run_energy);
    if (this.arena_wave > this.arena_best_wave) this.arena_best_wave = this.arena_wave;

    const is_final = this.arena_wave >= 10;
    let champion_tokens = 0, champion_energy = 0;
    if (is_final && !this.arena_champion_reward_claimed) {
      this.arena_champion_reward_claimed = true;
      champion_tokens = 5000; champion_energy = 500;
      this.add_tokens(champion_tokens); this.add_energy(champion_energy);
    }
    this.saveHighScores();

    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });
    this.menu_items = [];
    this.esc_back_command = () => this.show_play_menu();
    this.play_sound('fanfare');

    this.draw_token_header(theme);
    const title = is_final ? 'ARENA CLEARED!' : `MAP ${this.arena_map_index + 1} CLEARED!`;
    this.canvas.create_text(300,100,{ text:title, fill:YELLOW, font:['Impact',28] });
    this.canvas.create_text(300,150,{ text:`+${this.arena_run_tokens} Tokens    +${this.arena_run_energy} Energy`, fill:theme.text, font:['Helvetica Neue',14,'bold'] });
    this.canvas.create_text(300,178,{ text:`Hearts collected: ${this.arena_run_hearts}`, fill:RED, font:['Helvetica Neue',12] });

    let y = 205;
    if (this.arena_run_powerups.length) {
      const names = { hp:'Max HP Up', damage:'Weapon Up', speed:'Speed Up', sword:'Sword Cooldown Down' };
      this.canvas.create_text(300,y,{ text:`Power-ups: ${this.arena_run_powerups.map(p=>names[p]).join(', ')}`,
        fill:PURPLE, font:['Helvetica Neue',11,'bold'] });
      y += 26;
    }
    if (champion_tokens) {
      this.canvas.create_text(300,y,{ text:`ARENA CHAMPION BONUS:\n+${champion_tokens.toLocaleString('en-US')} Tokens + ${champion_energy} Energy`,
        fill:'#f59e0b', font:['Helvetica Neue',12,'bold'] });
      y += 44;
    }

    const by = Math.max(y + 40, 340);
    if (is_final) {
      this.make_menu_item('PLAY MENU', () => this.show_play_menu(), theme, 300, by, 220, 40);
    } else {
      this.make_menu_item('NEXT MAP', () => this.continue_arena_next_map(), theme, 300, by, 220, 44);
      this.make_menu_item('PLAY MENU', () => this.show_play_menu(), theme, 300, by+55, 220, 36);
    }
    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  continue_arena_next_map() {
    this.clear_screen();
    this.layout_game();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_music('sound/snake_music.m4a');

    this.game_type = 'SWORD_ARENA';
    this.game_running = true;
    this.arena_wave++;
    this.arena_map_index = Math.floor((this.arena_wave - 1) / 5);
    this.arena_hp = this.arena_max_hp;
    this.arena_enemies = [];
    this.arena_bullets = [];
    this.arena_bombs = [];
    this.arena_loot = [];
    this.arena_run_tokens = 0;
    this.arena_run_energy = 0;
    this.arena_run_hearts = 0;
    this.arena_run_powerups = [];
    this.session_tokens_earned = 0;

    this.setArenaTouch();
    this.onKey = k => {
      if (k === 'Escape') { this.quit_to_menu(); return true; }
      return false;
    };
    this.esc_back_command = () => this.quit_to_menu();

    this.spawn_arena_wave(this.arena_wave);
    this.run_arena_combat_loop();
  },

  finish_arena_death() {
    this.game_running = false;
    if (this.game_job) { clearTimeout(this.game_job); this.game_job = null; }
    this.clearArenaTouch();
    this.onKey = null;
    this.layout_menu();

    if (this.arena_wave > this.arena_best_wave) this.arena_best_wave = this.arena_wave;
    this.saveHighScores();

    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });
    this.menu_items = [];
    this.esc_back_command = () => this.show_play_menu();
    this.play_sound('lose');

    this.draw_token_header(theme);
    this.canvas.create_text(300,180,{ text:'YOU HAVE FALLEN', fill:RED, font:['Impact',34] });
    this.canvas.create_text(300,225,{ text:`Reached Wave ${this.arena_wave}`, fill:theme.text, font:['Helvetica Neue',14] });
    this.canvas.create_text(300,255,{ text:'No loot from this run — only collected loot pays out', fill:theme.muted, font:['Arial',10,'italic'] });

    this.make_menu_item('TRY AGAIN', () => this.start_sword_arena(), theme, 300, 340, 220, 40);
    this.make_menu_item('PLAY MENU', () => this.show_play_menu(), theme, 300, 390, 220, 36);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  // --- drawing ------------------------------------------------------------
  draw_arena_player(theme) {
    const x = this.arena_px, y = this.arena_py;
    const color = this.arena_stun_ticks <= 0 ? '#38bdf8' : '#a3a3a3';
    this.canvas.create_oval(x-14, y-14, x+14, y+14, { fill:color, outline:WHITE, width:2 });
    const [fx, fy] = this.arena_facing;
    this.canvas.create_line(x, y, x + fx*18, y + fy*18, { fill:WHITE, width:3 });

    if (this.arena_swing_anim > 0) {
      // A blade that sweeps a full circle over the swing, with a fading
      // trail behind the tip rather than a static expanding ring.
      const r = 55;
      const progress = (ARENA_SWING_TICKS - this.arena_swing_anim) / ARENA_SWING_TICKS;
      const angle_deg = progress * 360;
      const trail_deg = 110;
      this.canvas.create_arc(x-r, y-r, x+r, y+r,
        { start: angle_deg - trail_deg, extent: trail_deg, style:'pieslice',
          fill:'rgba(250,204,21,0.28)', outline:'' });
      const rad = angle_deg * Math.PI / 180;
      this.canvas.create_line(x, y, x + r*Math.cos(rad), y - r*Math.sin(rad), { fill:WHITE, width:4 });
    }
  },

  draw_arena_enemy(e) {
    const x = e.x, y = e.y;
    if (e.type === 'swordsman')
      this.canvas.create_polygon([x,y-14, x-12,y+10, x+12,y+10], { fill:'#dc2626', outline:BLACK });
    else if (e.type === 'shooter')
      this.canvas.create_polygon([x,y-12, x+12,y, x,y+12, x-12,y], { fill:'#3b82f6', outline:BLACK });
    else {
      this.canvas.create_oval(x-16, y-16, x+16, y+16, { fill:'#f97316', outline:BLACK, width:2 });
      this.canvas.create_text(x, y, { text:String(e.hp), fill:WHITE, font:['Arial',10,'bold'] });
    }
  },

  draw_arena_bullet(b) {
    this.canvas.create_oval(b.x-5, b.y-5, b.x+5, b.y+5, { fill:'#93c5fd', outline:'' });
  },

  draw_arena_bomb(bomb) {
    const pulse = Math.floor(bomb.timer/8) % 2 === 0 ? 2 : 4;
    const color = bomb.type === 'explosion' ? RED : '#a855f7';
    const r = bomb.radius;
    this.canvas.create_oval(bomb.x-r, bomb.y-r, bomb.x+r, bomb.y+r, { outline:color, width:pulse, fill:'' });
    this.canvas.create_oval(bomb.x-6, bomb.y-6, bomb.x+6, bomb.y+6, { fill:color, outline:'' });
  },

  draw_arena_loot(item) {
    const x = item.x, y = item.y;
    if (item.type === 'coin')
      this.canvas.create_oval(x-8, y-8, x+8, y+8, { fill:YELLOW, outline:WHITE });
    else if (item.type === 'energy')
      this.canvas.create_oval(x-8, y-8, x+8, y+8, { fill:PURPLE, outline:WHITE });
    else if (item.type === 'heart')
      this.canvas.create_text(x, y, { text:'♥', fill:RED, font:['Arial',16,'bold'] });
    else {
      this.canvas.create_oval(x-10, y-10, x+10, y+10, { fill:'#f59e0b', outline:WHITE, width:2 });
      this.canvas.create_text(x, y, { text:'★', fill:WHITE, font:['Arial',10,'bold'] });
    }
  },
});

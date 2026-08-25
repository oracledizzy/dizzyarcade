// snakelevels.js — the Snake 1-99 campaign and the pay-to-play Esoteric mode.

// Deterministic per-level RNG so a given level always generates the same
// layout (learnable on retry) while different levels differ.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

Object.assign(ArcadeApp.prototype, {

  // Shared by every snake mode so an equipped skin renders identically.
  draw_snake_body(theme) {
    const skin = this.get_active_snake_skin();
    this.snake.forEach(([sx, sy], i) => {
      if (skin && skin.head_pattern) {
        const pattern = i === 0 ? skin.head_pattern : skin.body_pattern;
        this.draw_pixel_pattern(sx, sy, pattern, skin.palette, 20 / pattern.length, null);
      } else {
        let color;
        if (skin) color = i === 0 ? skin.colors[0] : skin.colors[(i-1) % skin.colors.length];
        else color = i === 0 ? GREEN : theme.secondary;
        this.canvas.create_rectangle(sx, sy, sx+20, sy+20, { fill:color, outline:theme.bg });
      }
    });
  },

  bindSnakeControls() {
    this.turn_queue = [];
    this.onKey = k => {
      const map = { ArrowUp:'Up', ArrowDown:'Down', ArrowLeft:'Left', ArrowRight:'Right' };
      if (map[k]) { this.queue_turn(map[k]); return true; }
      if (k === 'Escape') { this.quit_to_menu(); return true; }
      return false;
    };
    this.setSwipeHandler(d => this.queue_turn(d));
    this.esc_back_command = () => this.quit_to_menu();
  },

  // Queues against the last *queued* direction rather than the one currently
  // being drawn, so a second turn in the same tick is judged against where
  // the snake will actually be facing when it lands.
  queue_turn(d) {
    const OPPOSITE = { Up:'Down', Down:'Up', Left:'Right', Right:'Left' };
    const ref = this.turn_queue.length
      ? this.turn_queue[this.turn_queue.length - 1]
      : this.snake_dir;
    if (d === ref || d === OPPOSITE[ref]) return;
    if (this.turn_queue.length >= TURN_QUEUE_MAX) return;
    this.turn_queue.push(d);
  },

  // Called once per tick in place of the old single-slot snake_next_dir.
  consume_turn() {
    if (this.turn_queue && this.turn_queue.length) this.snake_dir = this.turn_queue.shift();
    return this.snake_dir;
  },

  // --- level generation ---------------------------------------------------
  generate_level_obstacles(level) {
    const rng = mulberry32(level * 7919 + 12345);
    const count = Math.min(5 + Math.floor(level * 0.55), 65);
    const obstacles = new Set();
    let attempts = 0;
    while (obstacles.size < count && attempts < count * 25) {
      const x = (1 + Math.floor(rng()*28)) * 20;
      const y = (3 + Math.floor(rng()*26)) * 20;
      attempts++;
      if (Math.abs(x-100) + Math.abs(y-100) <= 80) continue;   // keep spawn clear
      obstacles.add(`${x},${y}`);
    }
    return obstacles;
  },

  get_level_coin_multiplier(level) { return 1 + (level - 1) * 0.15; },
  get_level_start_speed(level) {
    return Math.max(SNAKE_LEVEL_FLOOR_MS, SNAKE_LEVEL_START_MS - level * SNAKE_LEVEL_RAMP);
  },

  spawn_food_avoiding(obstacles) {
    while (true) {
      const x = (1 + Math.floor(Math.random()*28)) * 20;
      const y = (3 + Math.floor(Math.random()*26)) * 20;
      if (this.snake.some(([sx,sy]) => sx===x && sy===y)) continue;
      if (obstacles && obstacles.has(`${x},${y}`)) continue;
      return [x, y];
    }
  },

  spawn_coin_avoiding(obstacles) {
    while (true) {
      const x = (1 + Math.floor(Math.random()*28)) * 20;
      const y = (3 + Math.floor(Math.random()*26)) * 20;
      if (this.snake.some(([sx,sy]) => sx===x && sy===y)) continue;
      if (this.food[0]===x && this.food[1]===y) continue;
      if (obstacles && obstacles.has(`${x},${y}`)) continue;
      const roll = Math.random();
      let val;
      if (roll < 0.70)      val = 1 + Math.floor(Math.random()*10);
      else if (roll < 0.90) val = 25 + Math.floor(Math.random()*26);
      else                  val = 100 + Math.floor(Math.random()*151);
      return { x, y, val, ticks_left: 50 };
    }
  },

  // --- SNAKE LEVELS -------------------------------------------------------
  start_snake_level(level=null) {
    level = Math.max(1, Math.min(99, level ?? this.current_snake_level));
    this.current_snake_level = level;

    this.clear_screen();
    this.layout_game();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_music('sound/snake_music.m4a');

    this.game_type = 'SNAKE_LEVEL';
    this.game_running = true;
    this.snake_dir = 'Right';
    this.score = 0;
    this.snake = [[100,100],[80,100],[60,100]];
    this.snake_level_obstacles = this.generate_level_obstacles(level);
    this.food = this.spawn_food_avoiding(this.snake_level_obstacles);

    this.coin = null;
    this.session_tokens_earned = 0;
    this.snake_level_apples = 0;
    this.snake_level_coin_mult = this.get_level_coin_multiplier(level);

    this.snake_speed_ms = this.get_level_start_speed(level);
    this.snake_min_speed_ms = SNAKE_LEVEL_FLOOR_MS - 10;
    this.snake_speed_step_ms = SNAKE_STEP_MS;
    this.snake_bg_tier_seen = 0;
    this.snake_bg_announce_ticks = 0;

    this.bindSnakeControls();
    this.run_snake_level_loop();
  },

  run_snake_level_loop() {
    if (!this.game_running) return;
    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });
    const bg_tier = this.update_snake_bg_tier(this.score);
    this.draw_snake_background(theme, bg_tier);
    this.consume_turn();

    let [hx, hy] = this.snake[0];
    if (this.snake_dir === 'Up') hy -= 20;
    else if (this.snake_dir === 'Down') hy += 20;
    else if (this.snake_dir === 'Left') hx -= 20;
    else if (this.snake_dir === 'Right') hx += 20;

    const selfHit = this.snake.some(([sx,sy]) => sx===hx && sy===hy);
    if (hx < 0 || hx >= 600 || hy < 60 || hy >= 600 || selfHit ||
        this.snake_level_obstacles.has(`${hx},${hy}`)) {
      this.finish_snake_level_failed();
      return;
    }

    this.snake.unshift([hx, hy]);
    this.play_sound('move_bup');

    if (hx === this.food[0] && hy === this.food[1]) {
      this.score += 10;
      this.snake_level_apples++;
      this.play_sound('eat');
      if (this.snake_level_apples >= 6) { this.finish_snake_level_success(); return; }
      this.food = this.spawn_food_avoiding(this.snake_level_obstacles);
      if (!this.coin && Math.random() < 0.4) this.coin = this.spawn_coin_avoiding(this.snake_level_obstacles);
    } else {
      this.snake.pop();
    }

    if (this.coin) {
      if (hx === this.coin.x && hy === this.coin.y) {
        this.session_tokens_earned += Math.floor(this.coin.val * this.snake_level_coin_mult);
        this.coin = null;
        this.play_sound('coin');
        this.snake_speed_ms = Math.max(this.snake_min_speed_ms, this.snake_speed_ms - this.snake_speed_step_ms);
      } else if (--this.coin.ticks_left <= 0) this.coin = null;
    }

    this.canvas.create_rectangle(0,0,600,50,{ fill:theme.primary, outline:'' });
    this.canvas.create_text(50,25,{ text:`LVL ${this.current_snake_level}`, fill:WHITE, font:['Arial',13,'bold'] });
    this.canvas.create_text(150,25,{ text:`Apples: ${this.snake_level_apples}/6`, fill:GREEN, font:['Arial',11,'bold'] });
    const hearts = Array.from({length:3}, (_,i) => i < this.snake_level_lives ? '♥' : '♡').join('');
    this.canvas.create_text(270,25,{ text:hearts, fill:RED, font:['Arial',14,'bold'] });
    this.canvas.create_text(390,25,{ text:`+${this.session_tokens_earned}`, fill:YELLOW, font:['Arial',11,'bold'] });

    for (const key of this.snake_level_obstacles) {
      const [ox, oy] = key.split(',').map(Number);
      this.canvas.create_rectangle(ox, oy, ox+20, oy+20, { fill:'#44403c', outline:'#78716c' });
    }

    const [fx, fy] = this.food;
    this.canvas.create_oval(fx, fy, fx+20, fy+20, { fill:RED, outline:'' });

    if (this.coin) {
      const cx = this.coin.x+10, cy = this.coin.y+10;
      this.canvas.create_oval(cx-8, cy-8, cx+8, cy+8, { fill:YELLOW, outline:WHITE, width:1 });
      this.canvas.create_text(cx, cy, { text:'$', fill:BLACK, font:['Arial',9,'bold'] });
    }

    this.draw_snake_body(theme);
    this.draw_snake_bg_announce(bg_tier);
    this.drawQuitButton(theme);
    this.game_job = setTimeout(() => this.run_snake_level_loop(), Math.floor(this.snake_speed_ms));
  },

  finish_snake_level_success() {
    this.game_running = false;
    if (this.game_job) { clearTimeout(this.game_job); this.game_job = null; }
    this.clearSwipeHandler();
    this.onKey = null;
    this.layout_menu();

    if (this.session_tokens_earned > 0) this.add_tokens(this.session_tokens_earned);

    const level = this.current_snake_level;
    let milestone_bonus = 0, token_milestone_bonus = 0, win_bonus_tokens = 0, win_bonus_energy = 0;

    if (level === this.snake_level_progress && level < 99) this.snake_level_progress = level + 1;

    if (level % 5 === 0 && this.snake_level_token_milestone_claimed < level) {
      this.snake_level_token_milestone_claimed = level;
      token_milestone_bonus = level * 100;
      this.add_tokens(token_milestone_bonus);
    }
    if (level % 10 === 0 && this.snake_level_milestone_claimed < level) {
      this.snake_level_milestone_claimed = level;
      milestone_bonus = 100;
      this.add_energy(100);
    }
    if (level === 99 && !this.snake_level99_reward_claimed) {
      this.snake_level99_reward_claimed = true;
      win_bonus_tokens = 100000; win_bonus_energy = 10000;
      this.add_tokens(100000); this.add_energy(10000);
    }
    this.saveHighScores();

    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });
    this.menu_items = [];
    this.esc_back_command = () => this.show_snake_level_select();
    this.play_sound('fanfare');

    this.draw_token_header(theme);
    if (level === 99)
      this.canvas.create_text(300,150,{ text:'YOU BEAT\nALL 99 LEVELS!', fill:YELLOW, font:['Impact',28] });
    else
      this.canvas.create_text(300,150,{ text:`LEVEL ${level} COMPLETE!`, fill:GREEN, font:['Impact',30] });

    this.canvas.create_text(300,210,{ text:`Tokens earned: +${this.session_tokens_earned}`, fill:YELLOW, font:['Helvetica Neue',14,'bold'] });
    let y = 240;
    if (token_milestone_bonus) {
      this.canvas.create_text(300,y,{ text:`5-LEVEL BONUS: +${token_milestone_bonus.toLocaleString('en-US')} TOKENS`, fill:YELLOW, font:['Helvetica Neue',13,'bold'] });
      y += 28;
    }
    if (milestone_bonus) {
      this.canvas.create_text(300,y,{ text:`10-LEVEL BONUS: +${milestone_bonus} ENERGY`, fill:PURPLE, font:['Helvetica Neue',13,'bold'] });
      y += 28;
    }
    if (win_bonus_tokens) {
      this.canvas.create_text(300,y,{ text:`CHAMPION REWARD: +${win_bonus_tokens.toLocaleString('en-US')} TOKENS\n+${win_bonus_energy.toLocaleString('en-US')} ENERGY`,
        fill:'#f59e0b', font:['Helvetica Neue',13,'bold'] });
      y += 44;
    }

    let by = Math.max(y + 40, 380);
    if (level < 99) {
      this.make_menu_item('NEXT LEVEL', () => this.start_snake_level(level+1), theme, 300, by, 220, 40);
      by += 50;
    }
    this.make_menu_item('LEVEL SELECT', () => this.show_snake_level_select(), theme, 300, by, 220, 40);
    this.make_menu_item('PLAY MENU', () => this.show_play_menu(), theme, 300, by+50, 220, 36);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  finish_snake_level_failed() {
    this.game_running = false;
    if (this.game_job) { clearTimeout(this.game_job); this.game_job = null; }
    this.clearSwipeHandler();
    this.onKey = null;
    this.layout_menu();

    // Levels pay out only on completion — coins from a failed run are forfeited.
    const forfeited = this.session_tokens_earned;
    this.session_tokens_earned = 0;

    this.snake_level_lives--;
    const wiped_out = this.snake_level_lives <= 0;
    if (wiped_out) {
      this.snake_level_lives = 3;
      this.snake_level_progress = 1;
      // Milestone rewards already earned stay earned; only position resets.
    }
    this.saveHighScores();

    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });
    this.menu_items = [];
    this.esc_back_command = () => this.show_snake_level_select();
    this.play_sound('lose');

    this.draw_token_header(theme);
    this.canvas.create_text(300,160,{ text:'LEVEL FAILED', fill:RED, font:['Impact',36] });
    this.canvas.create_text(300,205,{ text:`Level ${this.current_snake_level}  —  Apples: ${this.snake_level_apples}/6`,
      fill:theme.text, font:['Helvetica Neue',14] });
    if (forfeited > 0)
      this.canvas.create_text(300,235,{ text:`${forfeited} tokens forfeited — levels only pay out on completion`,
        fill:theme.muted, font:['Arial',10,'italic'] });

    const hearts = Array.from({length:3}, (_,i) => i < this.snake_level_lives ? '♥' : '♡').join('');
    this.canvas.create_text(300,270,{ text:hearts, fill:RED, font:['Arial',22,'bold'] });

    let by = 320;
    if (wiped_out) {
      this.canvas.create_text(300,305,{ text:'OUT OF LIVES — BACK TO LEVEL 1', fill:RED, font:['Helvetica Neue',13,'bold'] });
      by = 350;
    } else {
      this.make_menu_item('RETRY LEVEL', () => this.start_snake_level(this.current_snake_level), theme, 300, by, 220, 40);
      by += 50;
    }
    this.make_menu_item('LEVEL SELECT', () => this.show_snake_level_select(), theme, 300, by, 220, 40);
    this.make_menu_item('PLAY MENU', () => this.show_play_menu(), theme, 300, by+50, 220, 36);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  // --- ESOTERIC SNAKE -----------------------------------------------------
  start_esoteric_snake_warning() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_snake_mode_select();
    this.play_sound('menu_open');
    this.game_type = 'ESOTERIC_SNAKE';

    const popup_bg = this.inverted ? '#d4d4db' : '#26262e';
    const text_color = this.inverted ? '#111114' : '#ffffff';

    this.rounded_rect(70,140,530,440,20,{ fill:popup_bg, outline:RED, width:3 });
    this.canvas.create_text(300,190,{ text:'⚠ ESOTERIC SNAKE ⚠', fill:RED, font:['Helvetica Neue',22,'bold'] });
    this.canvas.create_text(300,235,{ text:'THIS IS A PAY-TO-PLAY LEVEL', fill:text_color, font:['Helvetica Neue',14,'bold'] });
    this.canvas.create_text(300,262,{ text:'Costs 100 TOKENS every time you play.', fill:YELLOW, font:['Helvetica Neue',12] });
    this.canvas.create_text(300,320,{
      text:'Avoid the drifting pendulums — they end your run.\nCatch flashing angel orbs for growing token bonuses.\nEvery 7th orb purges all pendulums for 15s —\nrace to grab multiplying pentagrams while it lasts!',
      fill:text_color, font:['Helvetica Neue',11] });

    if (this.tokens >= 100)
      this.make_menu_item('PLAY (100 TOKENS)', () => this.start_esoteric_snake(), theme, 300, 395, 240, 42);
    else
      this.canvas.create_text(300,395,{ text:'NOT ENOUGH TOKENS', fill:RED, font:['Arial',12,'bold'] });

    this.make_menu_item('< BACK', () => this.show_snake_mode_select(), theme, 300, 460, 200, 38);
    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  spawn_pendulum() {
    const size = 24 + Math.floor(Math.random()*47);
    return {
      x: Math.floor(Math.random()*(600-size)),
      y: 60 + Math.floor(Math.random()*(540-size)),
      size,
      dx: (Math.random()<0.5?-1:1) * (1.5 + Math.random()*2.5),
      dy: (Math.random()<0.5?-1:1) * (1.5 + Math.random()*2.5),
      ticks_left: (5 + Math.floor(Math.random()*26)) * 10,
    };
  },

  spawn_angel_orb() {
    return { x: 30 + Math.floor(Math.random()*541), y: 90 + Math.floor(Math.random()*481), flash: 0 };
  },

  spawn_pentagram(count=1) {
    for (let i = 0; i < count; i++)
      this.es_pentagrams.push({
        x: 30 + Math.floor(Math.random()*541),
        y: 90 + Math.floor(Math.random()*481),
        dx: (Math.random()<0.5?-1:1) * 0.6,
        dy: (Math.random()<0.5?-1:1) * 0.6,
      });
  },

  trigger_pendulum_purge() {
    this.es_pendulums = [];
    this.es_purge_active = true;
    this.es_purge_ticks_left = 150;         // ~15s at 100ms ticks
    this.es_pentagrams = [];
    this.spawn_pentagram(2);
  },

  start_esoteric_snake() {
    if (this.tokens < 100) { this.start_esoteric_snake_warning(); return; }
    this.tokens -= 100;
    this.saveHighScores();

    this.clear_screen();
    this.layout_game();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_music('sound/snake_music.m4a');

    this.game_type = 'ESOTERIC_SNAKE';
    this.game_running = true;
    this.snake_dir = 'Right';
    this.score = 0;
    this.snake = [[100,100],[80,100],[60,100]];
    this.food = this.spawn_food();

    this.coin = null;
    this.session_tokens_earned = 0;
    this.snake_speed_ms = SNAKE_START_MS;
    this.snake_min_speed_ms = SNAKE_MIN_MS;
    this.snake_speed_step_ms = SNAKE_STEP_MS;

    this.es_pendulums = [];
    this.es_pendulum_spawn_timer = 10;
    this.es_angel_orbs = [];
    this.es_angel_orb_timer = 60 + Math.floor(Math.random()*61);
    this.es_orb_value = 50.0;
    this.es_orb_streak = 0;
    this.es_purge_active = false;
    this.es_purge_ticks_left = 0;
    this.es_pentagrams = [];
    this.es_pentagram_value = 66.0;

    this.snake_bg_tier_seen = 0;
    this.snake_bg_announce_ticks = 0;

    this.bindSnakeControls();
    this.run_esoteric_snake_loop();
  },

  run_esoteric_snake_loop() {
    if (!this.game_running) return;
    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });
    const bg_tier = this.update_snake_bg_tier(this.score);
    this.draw_snake_background(theme, bg_tier);
    this.consume_turn();

    let [hx, hy] = this.snake[0];
    if (this.snake_dir === 'Up') hy -= 20;
    else if (this.snake_dir === 'Down') hy += 20;
    else if (this.snake_dir === 'Left') hx -= 20;
    else if (this.snake_dir === 'Right') hx += 20;

    const selfHit = this.snake.some(([sx,sy]) => sx===hx && sy===hy);
    if (hx < 0 || hx >= 600 || hy < 60 || hy >= 600 || selfHit) {
      if (this.session_tokens_earned > 0) this.add_tokens(this.session_tokens_earned);
      this.end_game('GAME OVER');
      return;
    }

    this.snake.unshift([hx, hy]);
    this.play_sound('move_bup');

    if (hx === this.food[0] && hy === this.food[1]) {
      this.score += 10;
      this.food = this.spawn_food();
      this.play_sound('eat');
      if (!this.coin && Math.random() < 0.4) this.coin = this.spawn_snake_coin();
    } else {
      this.snake.pop();
    }

    if (this.coin) {
      if (hx === this.coin.x && hy === this.coin.y) {
        this.session_tokens_earned += this.coin.val;
        this.coin = null;
        this.play_sound('coin');
        this.snake_speed_ms = Math.max(this.snake_min_speed_ms, this.snake_speed_ms - this.snake_speed_step_ms);
      } else if (--this.coin.ticks_left <= 0) this.coin = null;
    }

    // --- pendulums ---
    if (!this.es_purge_active) {
      if (--this.es_pendulum_spawn_timer <= 0 && this.es_pendulums.length < 5) {
        this.es_pendulums.push(this.spawn_pendulum());
        this.es_pendulum_spawn_timer = 8 + Math.floor(Math.random()*13);
      }
    }
    for (const p of [...this.es_pendulums]) {
      p.x += p.dx; p.y += p.dy;
      if (p.x <= 0 || p.x + p.size >= 600) p.dx *= -1;
      if (p.y <= 60 || p.y + p.size >= 600) p.dy *= -1;
      if (--p.ticks_left <= 0) { this.es_pendulums.splice(this.es_pendulums.indexOf(p),1); continue; }
      if (p.x < hx+20 && p.x+p.size > hx && p.y < hy+20 && p.y+p.size > hy) {
        if (this.session_tokens_earned > 0) this.add_tokens(this.session_tokens_earned);
        this.end_game('CRUSHED BY A PENDULUM!');
        return;
      }
    }

    // --- angel orbs ---
    if (!this.es_purge_active) {
      if (--this.es_angel_orb_timer <= 0 && this.es_angel_orbs.length === 0) {
        this.es_angel_orbs.push(this.spawn_angel_orb());
        this.es_angel_orb_timer = 90 + Math.floor(Math.random()*91);
      }
    }
    for (const orb of [...this.es_angel_orbs]) {
      orb.flash = (orb.flash + 1) % 20;
      if (Math.abs(orb.x - (hx+10)) < 16 && Math.abs(orb.y - (hy+10)) < 16) {
        this.es_angel_orbs.splice(this.es_angel_orbs.indexOf(orb),1);
        this.session_tokens_earned += Math.floor(this.es_orb_value);
        this.play_sound('coin');
        this.es_orb_value *= 1.2;
        if (++this.es_orb_streak >= 7) { this.es_orb_streak = 0; this.trigger_pendulum_purge(); }
      }
    }

    // --- purge / pentagram bonus phase ---
    if (this.es_purge_active) {
      this.es_purge_ticks_left--;
      for (const pg of [...this.es_pentagrams]) {
        pg.x += pg.dx; pg.y += pg.dy;
        if (pg.x <= 10 || pg.x >= 590) pg.dx *= -1;
        if (pg.y <= 70 || pg.y >= 590) pg.dy *= -1;
        if (Math.abs(pg.x - (hx+10)) < 16 && Math.abs(pg.y - (hy+10)) < 16) {
          this.es_pentagrams.splice(this.es_pentagrams.indexOf(pg),1);
          this.session_tokens_earned += Math.floor(this.es_pentagram_value);
          this.play_sound('coin');
          this.es_pentagram_value *= 1.15;
          this.spawn_pentagram(2);
        }
      }
      if (this.es_purge_ticks_left <= 0) { this.es_purge_active = false; this.es_pentagrams = []; }
    }

    this.canvas.create_rectangle(0,0,600,50,{ fill:theme.primary, outline:'' });
    this.canvas.create_text(80,25,{ text:`Score: ${this.score}`, fill:WHITE, font:['Arial',14,'bold'] });
    this.canvas.create_text(240,25,{ text:`Tokens: +${this.session_tokens_earned}`, fill:YELLOW, font:['Arial',12,'bold'] });

    if (this.es_purge_active) {
      const secs = Math.max(1, Math.floor(this.es_purge_ticks_left/10));
      this.canvas.create_text(300,60,{ text:`PENDULUMS PURGED — ${secs}s — COLLECT PENTAGRAMS!`, fill:GREEN, font:['Arial',11,'bold'] });
    }

    const [fx, fy] = this.food;
    this.canvas.create_oval(fx, fy, fx+20, fy+20, { fill:RED, outline:'' });

    for (const p of this.es_pendulums)
      this.canvas.create_rectangle(p.x, p.y, p.x+p.size, p.y+p.size, { fill:WHITE, outline:'#cfcfcf', width:2 });

    for (const orb of this.es_angel_orbs)
      this.canvas.create_oval(orb.x-12, orb.y-12, orb.x+12, orb.y+12,
        { fill: orb.flash < 10 ? '#ffd700' : '#fff2b2', outline:WHITE, width:1 });

    for (const pg of this.es_pentagrams)
      this.canvas.create_text(pg.x, pg.y, { text:'★', fill:YELLOW, font:['Arial',18,'bold'] });

    if (this.coin) {
      const cx = this.coin.x+10, cy = this.coin.y+10;
      this.canvas.create_oval(cx-8, cy-8, cx+8, cy+8, { fill:YELLOW, outline:WHITE, width:1 });
      this.canvas.create_text(cx, cy, { text:'$', fill:BLACK, font:['Arial',9,'bold'] });
    }

    this.draw_snake_body(theme);
    this.draw_snake_bg_announce(bg_tier);
    this.drawQuitButton(theme);
    this.game_job = setTimeout(() => this.run_esoteric_snake_loop(), Math.floor(this.snake_speed_ms));
  },
});

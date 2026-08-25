// snake.js — port of start_snake / run_snake_loop, plus swipe controls.

const SNAKE_BG_THRESHOLDS = [0, 50, 100, 200, 400, 800];
const SNAKE_BG_TIER_NAMES = ['', 'DOTTED SKY', 'CORNERED ARENA', 'FRAMED ARENA', 'STRIPED ZONE', 'STARLIT ARENA'];
// Deterministic scatter (multiplicative hashing, not random) so the top tier
// looks identical every run — no flicker, no regeneration each tick.
const SNAKE_STARFIELD = Array.from({ length: 35 }, (_, i) => [(37*i)%580 + 10, (53*i)%520 + 70]);

Object.assign(ArcadeApp.prototype, {

  get_snake_bg_tier(score) {
    let tier = 0;
    SNAKE_BG_THRESHOLDS.forEach((t, i) => { if (score >= t) tier = i; });
    return tier;
  },

  draw_snake_background(theme, tier) {
    // Cumulative: each tier keeps the lower tiers' decoration and adds a layer.
    if (tier >= 1)
      for (let gx = 40; gx < 600; gx += 60)
        for (let gy = 80; gy < 600; gy += 60)
          this.canvas.create_oval(gx-1, gy-1, gx+1, gy+1, { fill: theme.muted, outline:'' });

    if (tier >= 2) {
      const a = theme.accent;
      this.canvas.create_polygon([0,60, 50,60, 0,110], { fill:a, outline:'' });
      this.canvas.create_polygon([600,60, 550,60, 600,110], { fill:a, outline:'' });
      this.canvas.create_polygon([0,600, 50,600, 0,550], { fill:a, outline:'' });
      this.canvas.create_polygon([600,600, 550,600, 600,550], { fill:a, outline:'' });
    }

    if (tier >= 3)
      this.canvas.create_rectangle(4, 64, 596, 596, { outline: theme.accent, width:2, fill:'' });

    if (tier >= 4)
      for (let i = -600; i < 600; i += 80)
        this.canvas.create_line(i, 60, i+600, 660, { fill: theme.muted, width:1 });

    if (tier >= 5)
      for (const [sx, sy] of SNAKE_STARFIELD)
        this.canvas.create_oval(sx, sy, sx+2, sy+2, { fill: WHITE, outline:'' });
  },

  update_snake_bg_tier(score) {
    const tier = this.get_snake_bg_tier(score);
    if (tier > this.snake_bg_tier_seen) {
      this.snake_bg_tier_seen = tier;
      this.snake_bg_announce_ticks = 25;
      this.play_sound('fanfare');
    }
    return tier;
  },

  draw_snake_bg_announce(tier) {
    if (this.snake_bg_announce_ticks > 0) {
      this.canvas.create_text(300, 300, {
        text: `NEW BACKDROP!\n${SNAKE_BG_TIER_NAMES[tier]}`,
        fill: YELLOW, font: ['Impact', 22] });
      this.snake_bg_announce_ticks--;
    }
  },

  spawn_food() {
    while (true) {
      const x = (1 + Math.floor(Math.random()*28)) * 20;
      const y = (3 + Math.floor(Math.random()*26)) * 20;
      if (!this.snake.some(([sx,sy]) => sx===x && sy===y)) return [x, y];
    }
  },

  spawn_snake_coin() {
    while (true) {
      const x = (1 + Math.floor(Math.random()*28)) * 20;
      const y = (3 + Math.floor(Math.random()*26)) * 20;
      if (this.snake.some(([sx,sy]) => sx===x && sy===y)) continue;
      if (this.food[0]===x && this.food[1]===y) continue;
      const roll = Math.random();
      let val;
      if (roll < 0.70)      val = 1 + Math.floor(Math.random()*10);
      else if (roll < 0.90) val = 25 + Math.floor(Math.random()*26);
      else                  val = 100 + Math.floor(Math.random()*151);
      return { x, y, val, ticks_left: 50 };
    }
  },

  start_snake() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_music('sound/snake_music.m4a');

    this.game_type = 'SNAKE';
    this.game_running = true;
    this.snake_dir = 'Right';
    this.snake_next_dir = 'Right';
    this.score = 0;
    this.snake = [[100,100],[80,100],[60,100]];
    this.food = this.spawn_food();

    this.coin = null;
    this.session_tokens_earned = 0;

    this.snake_speed_ms = 100;
    this.snake_min_speed_ms = 55;
    this.snake_speed_step_ms = 1.5;

    this.snake_bg_tier_seen = 0;
    this.snake_bg_announce_ticks = 0;

    const OPPOSITE = { Up:'Down', Down:'Up', Left:'Right', Right:'Left' };
    const turn = d => { if (OPPOSITE[d] !== this.snake_dir) this.snake_next_dir = d; };

    this.onKey = k => {
      const map = { ArrowUp:'Up', ArrowDown:'Down', ArrowLeft:'Left', ArrowRight:'Right' };
      if (map[k]) { turn(map[k]); return true; }
      if (k === 'Escape') { this.quit_to_menu(); return true; }
      return false;
    };
    this.setSwipeHandler(turn);
    this.esc_back_command = () => this.quit_to_menu();

    this.run_snake_loop();
  },

  run_snake_loop() {
    if (!this.game_running) return;
    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });
    const bg_tier = this.update_snake_bg_tier(this.score);
    this.draw_snake_background(theme, bg_tier);
    this.snake_dir = this.snake_next_dir;

    let [hx, hy] = this.snake[0];
    if (this.snake_dir === 'Up') hy -= 20;
    else if (this.snake_dir === 'Down') hy += 20;
    else if (this.snake_dir === 'Left') hx -= 20;
    else if (this.snake_dir === 'Right') hx += 20;

    const hit = this.snake.some(([sx,sy]) => sx===hx && sy===hy);
    if (hx < 0 || hx >= 600 || hy < 60 || hy >= 600 || hit) {
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
      } else if (--this.coin.ticks_left <= 0) {
        this.coin = null;
      }
    }

    this.canvas.create_rectangle(0,0,600,50,{ fill: theme.primary, outline:'' });
    this.canvas.create_text(80,25,{ text:`Score: ${this.score}`, fill:WHITE, font:['Arial',14,'bold'] });
    this.canvas.create_text(240,25,{ text:`Tokens: +${this.session_tokens_earned}`, fill:YELLOW, font:['Arial',12,'bold'] });

    const [fx, fy] = this.food;
    this.canvas.create_oval(fx, fy, fx+20, fy+20, { fill:RED, outline:'' });

    if (this.coin) {
      const cx = this.coin.x + 10, cy = this.coin.y + 10;
      this.canvas.create_oval(cx-8, cy-8, cx+8, cy+8, { fill:YELLOW, outline:WHITE, width:1 });
      this.canvas.create_text(cx, cy, { text:'$', fill:BLACK, font:['Arial',9,'bold'] });
    }

    this.snake.forEach(([sx,sy], i) => {
      const color = i === 0 ? GREEN : theme.secondary;
      this.canvas.create_rectangle(sx, sy, sx+20, sy+20, { fill:color, outline:theme.bg });
    });

    this.draw_snake_bg_announce(bg_tier);
    this.drawQuitButton(theme);
    this.game_job = setTimeout(() => this.run_snake_loop(), Math.floor(this.snake_speed_ms));
  },
});

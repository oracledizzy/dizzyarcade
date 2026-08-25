// flappy.js — port of start_flappy / run_flappy_loop, plus tap-to-jump.

Object.assign(ArcadeApp.prototype, {

  spawn_pipe() {
    const gap = 160;
    const top_height = 80 + Math.floor(Math.random() * 241);   // 80..320
    const has_coin = Math.random() < 0.5;
    this.pipes.push({
      x: 600, top: top_height, bottom: top_height + gap,
      passed: false, has_coin,
      coin_y: has_coin ? top_height + gap/2 : null,
      coin_collected: false,
    });
  },

  start_flappy() {
    this.clear_screen();
    this.layout_game();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_music('sound/flappy_music.m4a');

    this.game_type = 'FLAPPY';
    this.game_running = true;

    this.bird_x = 100;
    this.bird_y = 250;
    this.bird_radius = 15;
    this.velocity = 0;
    this.gravity = 0.8;
    this.jump_strength = -11;

    this.flappy_score = 0;
    this.score = null;               // end_game prefers .score; Flappy uses its own
    this.session_tokens_earned = 0;
    this.flappy_frame = 0;
    this.pipes = [];
    this.spawn_pipe();

    const jump = () => {
      if (!this.game_running) return;
      this.velocity = this.jump_strength;
      this.play_sound('flap');
    };

    this.onKey = k => {
      if (k === ' ' || k === 'ArrowUp') { jump(); return true; }
      if (k === 'Escape') { this.quit_to_menu(); return true; }
      return false;
    };
    // Tap anywhere to flap — but not on the MENU chip, which owns its own hit.
    this.setTapHandler(p => {
      if (p && p.x > 495 && p.y < 50) return;   // MENU chip owns that corner
      jump();
    });
    this.esc_back_command = () => this.quit_to_menu();

    this.run_flappy_loop();
  },

  run_flappy_loop() {
    if (!this.game_running) return;
    const theme = this.get_theme();
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });

    this.flappy_frame++;
    this.velocity += this.gravity;
    this.bird_y += this.velocity;

    for (const p of this.pipes) p.x -= 4;
    if (this.pipes.length && this.pipes[this.pipes.length-1].x < 380) this.spawn_pipe();
    if (this.pipes.length && this.pipes[0].x < -60) this.pipes.shift();

    for (const pipe of this.pipes) {
      if (!pipe.passed && pipe.x < this.bird_x) { pipe.passed = true; this.flappy_score++; }

      if (pipe.has_coin && !pipe.coin_collected) {
        const coin_x = pipe.x + 25;
        if (Math.abs(this.bird_x - coin_x) < this.bird_radius + 10 &&
            Math.abs(this.bird_y - pipe.coin_y) < this.bird_radius + 10) {
          pipe.coin_collected = true;
          const roll = Math.random();
          let val;
          if (roll < 0.70)      val = 1 + Math.floor(Math.random()*10);
          else if (roll < 0.90) val = 25 + Math.floor(Math.random()*26);
          else                  val = 100 + Math.floor(Math.random()*151);
          this.session_tokens_earned += val;
          this.play_sound('coin');
        }
      }

      if (pipe.x < this.bird_x + this.bird_radius && pipe.x + 50 > this.bird_x - this.bird_radius) {
        if (this.bird_y - this.bird_radius < pipe.top || this.bird_y + this.bird_radius > pipe.bottom) {
          this.finish_flappy();
          return;
        }
      }
    }

    if (this.bird_y + this.bird_radius >= 600 || this.bird_y - this.bird_radius <= 50) {
      this.finish_flappy();
      return;
    }

    this.canvas.create_rectangle(0,0,600,50,{ fill: theme.secondary, outline:'' });
    this.canvas.create_text(80,25,{ text:`Score: ${this.flappy_score}`, fill:WHITE, font:['Arial',14,'bold'] });
    this.canvas.create_text(240,25,{ text:`Tokens: +${this.session_tokens_earned}`, fill:YELLOW, font:['Arial',12,'bold'] });

    for (const pipe of this.pipes) {
      const px = pipe.x;
      this.canvas.create_rectangle(px, 50, px+50, pipe.top, { fill:GREEN, outline:BLACK, width:2 });
      this.canvas.create_rectangle(px, pipe.bottom, px+50, 600, { fill:GREEN, outline:BLACK, width:2 });
      if (pipe.has_coin && !pipe.coin_collected) {
        const cx = px + 25, cy = pipe.coin_y;
        this.canvas.create_oval(cx-8, cy-8, cx+8, cy+8, { fill:YELLOW, outline:WHITE, width:1 });
        this.canvas.create_text(cx, cy, { text:'$', fill:BLACK, font:['Arial',9,'bold'] });
      }
    }

    const colors = this.get_active_flappy_colors();
    const bird_fill = colors[Math.floor(this.flappy_frame/6) % colors.length];
    this.canvas.create_oval(
      this.bird_x - this.bird_radius, this.bird_y - this.bird_radius,
      this.bird_x + this.bird_radius, this.bird_y + this.bird_radius,
      { fill: bird_fill, outline: BLACK, width:2 });

    this.drawQuitButton(theme);
    this.game_job = setTimeout(() => this.run_flappy_loop(), 30);
  },

  finish_flappy() {
    // Score converts to tokens at the same ratio Alt Dimension uses, then any
    // active store-bought multiplier is applied on top.
    const mult = this.get_active_multiplier();
    this.session_tokens_earned += Math.floor(this.flappy_score * 0.25 * mult);
    if (this.session_tokens_earned > 0) this.add_tokens(this.session_tokens_earned);
    this.end_game('CRASHED!');
  },
});

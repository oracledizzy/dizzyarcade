// altdimension.js — Flappy's unlockable "Alt Dimension" mode.
//
// Same flight model as Flappy, but the palette drains from sunny to somber as
// you score, and catching a devil doubles your score multiplier.

Object.assign(ArcadeApp.prototype, {

  // Interpolates a hyper-sunny palette toward a somber one; darkness caps
  // out around 60 points, per the original design.
  get_alt_dimension_colors(score) {
    const t = Math.min(score, 60) / 60;
    const lerp = (a, b) => a.map((v,i) => Math.round(v + (b[i]-v)*t));
    const hex = c => '#' + c.map(v => v.toString(16).padStart(2,'0')).join('');
    return [ hex(lerp([255,244,194],[30,24,40])), hex(lerp([255,183,77],[58,48,68])) ];
  },

  // Devils favour the tight pipe-gap edges — the hardest places to reach.
  spawn_devil() {
    let x, y;
    if (this.pipes.length) {
      const ref = this.pipes[this.pipes.length-1];
      x = ref.x + (Math.random() < 0.5 ? -30 : 100);
      y = Math.random() < 0.5 ? ref.top + 18 : ref.bottom - 18;
    } else {
      x = 620;
      y = 90 + Math.floor(Math.random()*431);
    }
    this.ad_devils.push({ x, y });
  },

  draw_devil_icon(cx, cy) {
    this.canvas.create_oval(cx-13, cy-13, cx+13, cy+13, { fill:'#c40000', outline:BLACK, width:1 });
    this.canvas.create_polygon([cx-10,cy-10, cx-4,cy-19, cx-2,cy-8], { fill:'#c40000', outline:BLACK });
    this.canvas.create_polygon([cx+10,cy-10, cx+4,cy-19, cx+2,cy-8], { fill:'#c40000', outline:BLACK });
    this.canvas.create_oval(cx-6, cy-3, cx-2, cy+1, { fill:YELLOW, outline:'' });
    this.canvas.create_oval(cx+2, cy-3, cx+6, cy+1, { fill:YELLOW, outline:'' });
    this.canvas.create_arc(cx-8, cy-1, cx+8, cy+11, { start:200, extent:140, style:'arc', outline:BLACK, width:2 });
  },

  start_alt_dimension() {
    this.clear_screen();
    this.canvas.configure({ bg:'#fff4c2' });
    this.play_music('sound/flappy_music.m4a');

    this.game_type = 'ALT_DIMENSION';
    this.game_running = true;

    this.bird_x = 100;
    this.bird_y = 250;
    this.bird_radius = 15;
    this.velocity = 0;
    this.gravity = 0.8;
    this.jump_strength = -11;

    this.flappy_score = 0;
    this.score = null;
    this.session_tokens_earned = 0;
    this.flappy_frame = 0;
    this.pipes = [];
    this.ad_devils = [];
    this.ad_multiplier = 1;
    this.ad_devil_timer = 90 + Math.floor(Math.random()*71);
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
    this.setTapHandler(p => { if (p && p.x > 495 && p.y < 50) return; jump(); });
    this.esc_back_command = () => this.quit_to_menu();

    this.run_alt_dimension_loop();
  },

  run_alt_dimension_loop() {
    if (!this.game_running) return;
    const [bg_hex, pipe_hex] = this.get_alt_dimension_colors(this.flappy_score);
    this.canvas.delete('all');
    this.canvas.configure({ bg: bg_hex });

    this.flappy_frame++;
    this.velocity += this.gravity;
    this.bird_y += this.velocity;

    for (const p of this.pipes) p.x -= 4;
    for (const d of this.ad_devils) d.x -= 4;

    if (this.pipes.length && this.pipes[this.pipes.length-1].x < 380) this.spawn_pipe();
    if (this.pipes.length && this.pipes[0].x < -60) this.pipes.shift();
    this.ad_devils = this.ad_devils.filter(d => d.x > -30);

    if (--this.ad_devil_timer <= 0) {
      this.spawn_devil();
      this.ad_devil_timer = 150 + Math.floor(Math.random()*111);
    }

    for (const pipe of this.pipes) {
      if (!pipe.passed && pipe.x < this.bird_x) {
        pipe.passed = true;
        this.flappy_score += 1 * this.ad_multiplier;
      }
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
          this.finish_alt_dimension();
          return;
        }
      }
    }

    for (const d of [...this.ad_devils]) {
      if (Math.abs(this.bird_x - d.x) < this.bird_radius + 12 &&
          Math.abs(this.bird_y - d.y) < this.bird_radius + 12) {
        this.ad_devils.splice(this.ad_devils.indexOf(d), 1);
        this.ad_multiplier *= 2;
        this.play_sound('fanfare');
      }
    }

    if (this.bird_y + this.bird_radius >= 600 || this.bird_y - this.bird_radius <= 50) {
      this.finish_alt_dimension();
      return;
    }

    this.canvas.create_rectangle(0,0,600,50,{ fill:pipe_hex, outline:'' });
    this.canvas.create_text(70,25,{ text:`Score: ${this.flappy_score}`, fill:WHITE, font:['Arial',14,'bold'] });
    this.canvas.create_text(210,25,{ text:`Multiplier: x${this.ad_multiplier}`, fill:YELLOW, font:['Arial',12,'bold'] });
    this.canvas.create_text(360,25,{ text:`+${this.session_tokens_earned}`, fill:YELLOW, font:['Arial',12,'bold'] });

    for (const pipe of this.pipes) {
      const px = pipe.x;
      this.canvas.create_rectangle(px, 50, px+50, pipe.top, { fill:pipe_hex, outline:BLACK, width:2 });
      this.canvas.create_rectangle(px, pipe.bottom, px+50, 600, { fill:pipe_hex, outline:BLACK, width:2 });
      if (pipe.has_coin && !pipe.coin_collected) {
        const cx = px+25, cy = pipe.coin_y;
        this.canvas.create_oval(cx-8, cy-8, cx+8, cy+8, { fill:YELLOW, outline:WHITE, width:1 });
        this.canvas.create_text(cx, cy, { text:'$', fill:BLACK, font:['Arial',9,'bold'] });
      }
    }

    for (const d of this.ad_devils) this.draw_devil_icon(d.x, d.y);

    const colors = this.get_active_flappy_colors();
    const bird_fill = colors[Math.floor(this.flappy_frame/6) % colors.length];
    this.canvas.create_oval(this.bird_x-this.bird_radius, this.bird_y-this.bird_radius,
      this.bird_x+this.bird_radius, this.bird_y+this.bird_radius,
      { fill:bird_fill, outline:BLACK, width:2 });

    this.drawQuitButton(this.get_theme());
    this.game_job = setTimeout(() => this.run_alt_dimension_loop(), 30);
  },

  finish_alt_dimension() {
    // The devil multiplier scales the score; an active store multiplier then
    // scales the token conversion on top of that.
    const mult = this.get_active_multiplier();
    this.session_tokens_earned += Math.floor(this.flappy_score * 0.25 * mult);
    if (this.session_tokens_earned > 0) this.add_tokens(this.session_tokens_earned);
    this.end_game('CRASHED!');
  },
});

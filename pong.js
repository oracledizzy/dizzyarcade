// pong.js — two-player Pong.
//
// The desktop build used W/S against the arrow keys. On a phone each player
// owns one half of the screen and drags their paddle directly with a finger;
// pointer ids are tracked so both thumbs work at the same time.

Object.assign(ArcadeApp.prototype, {

  prep_pong() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_play_menu();
    this.play_sound('menu_open');
    this.game_type = 'PONG';

    const popup_bg = this.inverted ? '#d4d4db' : '#26262e';
    const text_color = this.inverted ? '#111114' : '#ffffff';
    const tag = 'pong_start_trigger';

    this.rounded_rect(100,140,500,460,20,{ fill:popup_bg, outline:theme.accent, width:3, tags:[tag] });
    this.canvas.create_text(300,190,{ text:'PONG (2 PLAYER)', fill:text_color, font:['Helvetica Neue',22,'bold'], tags:[tag] });
    this.canvas.create_text(300,235,{ text:'CONTROLS', fill:theme.accent, font:['Helvetica Neue',14,'bold'], tags:[tag] });
    this.canvas.create_text(300,285,{ text:'Drag on the LEFT half to move\nthe left paddle', fill:text_color, font:['Helvetica Neue',13], tags:[tag] });
    this.canvas.create_text(300,340,{ text:'Drag on the RIGHT half to move\nthe right paddle', fill:text_color, font:['Helvetica Neue',13], tags:[tag] });
    this.canvas.create_text(300,405,{ text:'TAP TO PLAY  —  FIRST TO 5', fill:GREEN, font:['Helvetica Neue',16,'bold'], tags:[tag] });

    const cmd = () => this.start_pong();
    this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
    this.menu_items = [{ type:'custom', cx:300, cy:300, w:400, h:320, command:cmd }];
    this.menu_active = true;
    this.menu_selected_index = 0;
  },

  start_pong() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.play_music('sound/snake_music.m4a');

    this.game_type = 'PONG';
    this.game_running = true;

    this.paddle_w = 12;
    this.paddle_h = 90;
    this.p1_y = 300 - this.paddle_h/2;
    this.p2_y = 300 - this.paddle_h/2;

    this.p1_score = 0;
    this.p2_score = 0;
    this.score = null;
    this.session_tokens_earned = 0;

    this.setPongTouch();
    this.onKey = k => {
      if (k === 'Escape') { this.quit_to_menu(); return true; }
      return false;
    };
    this.esc_back_command = () => this.quit_to_menu();

    this.start_pong_round(Math.random() < 0.5 ? -1 : 1);
  },

  // Each active pointer steers whichever paddle its half of the screen owns.
  setPongTouch() {
    this.clearPongTouch();
    const el = this.canvas.el;
    const centre = () => this.paddle_h / 2;
    const place = (which, vy) => {
      const y = Math.max(60, Math.min(600 - this.paddle_h, vy - centre()));
      if (which === 1) this.p1_y = y; else this.p2_y = y;
    };
    const handle = e => {
      const p = this.canvas.toVirtual(e.clientX, e.clientY);
      if (p.y < 55) return;                       // leave the HUD row alone
      place(p.x < 300 ? 1 : 2, p.y);
    };
    const down = e => { el.setPointerCapture?.(e.pointerId); handle(e); };
    const move = e => { if (e.pressure > 0 || e.buttons || e.pointerType === 'touch') handle(e); };

    this._pong = { down, move };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
  },

  clearPongTouch() {
    if (!this._pong) return;
    this.canvas.el.removeEventListener('pointerdown', this._pong.down);
    this.canvas.el.removeEventListener('pointermove', this._pong.move);
    this._pong = null;
  },

  start_pong_round(direction) {
    this.ball_x = 300;
    this.ball_y = 300;
    this.ball_r = 8;
    this.ball_dx = 0;
    this.ball_dy = 0;
    this.countdown_value = 3;
    this.next_ball_direction = direction;
    this.run_pong_countdown_step();
  },

  draw_pong_field(theme) {
    this.canvas.delete('all');
    this.canvas.configure({ bg: theme.bg });

    this.canvas.create_rectangle(0,0,600,50,{ fill:theme.primary, outline:'' });
    this.canvas.create_text(150,25,{ text:`P1: ${this.p1_score}`, fill:WHITE, font:['Arial',16,'bold'] });
    this.canvas.create_text(450,25,{ text:`P2: ${this.p2_score}`, fill:WHITE, font:['Arial',16,'bold'] });

    for (let ly = 60; ly < 600; ly += 20)
      this.canvas.create_line(300, ly, 300, ly+10, { fill:theme.muted, width:2 });

    const p1_x = 40, p2_x = 560 - this.paddle_w;
    this.rounded_rect(p1_x, this.p1_y, p1_x+this.paddle_w, this.p1_y+this.paddle_h, 4, { fill:theme.accent, outline:'' });
    this.rounded_rect(p2_x, this.p2_y, p2_x+this.paddle_w, this.p2_y+this.paddle_h, 4, { fill:theme.accent, outline:'' });
    this.canvas.create_oval(this.ball_x-this.ball_r, this.ball_y-this.ball_r,
      this.ball_x+this.ball_r, this.ball_y+this.ball_r, { fill:WHITE, outline:'' });

    this.drawQuitButton(theme);
  },

  run_pong_countdown_step() {
    if (!this.game_running) return;
    const theme = this.get_theme();
    this.draw_pong_field(theme);

    if (this.countdown_value > 0) {
      this.canvas.create_text(300,300,{ text:String(this.countdown_value), fill:YELLOW, font:['Impact',64] });
      this.countdown_value--;
      this.game_job = setTimeout(() => this.run_pong_countdown_step(), 1000);
    } else {
      this.ball_dx = this.next_ball_direction * 5.5;
      this.ball_dy = [-4,-3,3,4][Math.floor(Math.random()*4)];
      this.run_pong_loop();
    }
  },

  run_pong_loop() {
    if (!this.game_running) return;
    const theme = this.get_theme();

    this.ball_x += this.ball_dx;
    this.ball_y += this.ball_dy;

    if (this.ball_y - this.ball_r <= 55) {
      this.ball_y = 55 + this.ball_r; this.ball_dy *= -1;
    } else if (this.ball_y + this.ball_r >= 600) {
      this.ball_y = 600 - this.ball_r; this.ball_dy *= -1;
    }

    const p1_x = 40, p2_x = 560 - this.paddle_w;

    if (this.ball_x - this.ball_r <= p1_x + this.paddle_w &&
        this.ball_x + this.ball_r >= p1_x &&
        this.ball_y >= this.p1_y && this.ball_y <= this.p1_y + this.paddle_h) {
      this.ball_x = p1_x + this.paddle_w + this.ball_r;
      this.ball_dx *= -1.05;
      this.ball_dy = (this.ball_y - (this.p1_y + this.paddle_h/2)) * 0.15;
      this.play_sound('block_hit');
    }

    if (this.ball_x + this.ball_r >= p2_x &&
        this.ball_x - this.ball_r <= p2_x + this.paddle_w &&
        this.ball_y >= this.p2_y && this.ball_y <= this.p2_y + this.paddle_h) {
      this.ball_x = p2_x - this.ball_r;
      this.ball_dx *= -1.05;
      this.ball_dy = (this.ball_y - (this.p2_y + this.paddle_h/2)) * 0.15;
      this.play_sound('block_hit');
    }

    if (this.ball_x < 0) {
      this.p2_score++;
      if (this.p2_score >= 5) { this.end_game('PLAYER 2 WINS!'); return; }
      this.start_pong_round(1); return;
    }
    if (this.ball_x > 600) {
      this.p1_score++;
      if (this.p1_score >= 5) { this.end_game('PLAYER 1 WINS!'); return; }
      this.start_pong_round(-1); return;
    }

    this.draw_pong_field(theme);
    this.game_job = setTimeout(() => this.run_pong_loop(), 20);
  },
});

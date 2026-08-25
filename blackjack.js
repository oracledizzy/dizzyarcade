// blackjack.js — casino blackjack, played with the shared token balance.

Object.assign(ArcadeApp.prototype, {

  start_blackjack_betting() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_play_menu();
    this.play_sound('menu_open');
    this.game_type = 'BLACKJACK';
    this.menu_active = false;

    this.draw_token_header(theme);
    this.canvas.create_text(300,85,{ text:'CASINO BLACKJACK', fill:theme.text, font:['Helvetica Neue',28,'bold'] });
    this.canvas.create_text(300,122,{ text:`CREDITS: ${this.format_tokens(this.tokens)}`, fill:YELLOW, font:['Helvetica Neue',16,'bold'] });

    if (this.tokens <= 0) {
      this.canvas.create_text(300,200,{ text:'NO TOKENS LEFT TO BET —', fill:RED, font:['Helvetica Neue',13,'bold'] });
      this.canvas.create_text(300,222,{ text:'earn more in Snake, Flappy, or the Store!', fill:theme.muted, font:['Helvetica Neue',11] });
      this.make_menu_item('< GAME MENU', () => this.show_play_menu(), theme, 300, 290, 200, 40);
      this.menu_active = true;
      this.menu_selected_index = 0;
      this.refresh_menu_highlight();
      return;
    }

    this.bj_custom_bet = Math.max(1, Math.min(this.bj_custom_bet, this.tokens, 5000));

    this.canvas.create_text(300,158,{ text:'QUICK BET', fill:theme.muted, font:['Helvetica Neue',12] });
    const bets = [10,50,100,500,1000].filter(b => b <= this.tokens);
    const spacing = 92;
    const offset = bets.length ? -(bets.length-1)/2 * spacing : 0;
    bets.forEach((b,i) => {
      this.make_menu_item(String(b), () => this.place_blackjack_bet(b), theme, 300+offset+i*spacing, 198, 76, 36);
    });

    this.canvas.create_text(300,250,{ text:'CUSTOM BET  (1 - 5000)', fill:theme.muted, font:['Helvetica Neue',12] });
    this.draw_custom_bet_slider(theme, 295);

    this.make_menu_item('PLACE CUSTOM BET', () => this.place_blackjack_bet(this.bj_custom_bet), theme, 300, 350, 230, 40);
    this.make_menu_item('ALL IN', () => this.place_blackjack_bet(this.tokens), theme, 300, 402, 230, 38);
    this.make_menu_item('< GAME MENU', () => this.show_play_menu(), theme, 300, 460, 200, 38);

    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  draw_custom_bet_slider(theme, cy=295) {
    const mk = (tag, x1, x2, tx, glyph, delta) => {
      this.rounded_rect(x1, cy-20, x2, cy+20, 10, { fill:theme.bg, outline:theme.muted, width:1, tags:[tag] });
      this.canvas.create_text(tx, cy, { text:glyph, fill:theme.accent, font:['Arial',16,'bold'], tags:[tag] });
      const cmd = () => this.adjust_custom_bet(delta);
      const idx = this.menu_items.length;
      this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx:tx, cy, w:40, h:40, command:cmd, role:'bj_slider' });
    };
    mk('bj_slider_left', 215, 255, 235, '◀', -10);
    mk('bj_slider_right', 345, 385, 365, '▶', 10);
    this.canvas.create_text(300, cy, { text:String(this.bj_custom_bet), fill:YELLOW, font:['Helvetica Neue',22,'bold'] });
  },

  adjust_custom_bet(delta) {
    this.bj_custom_bet = Math.max(1, Math.min(5000, this.tokens, this.bj_custom_bet + delta));
    this.start_blackjack_betting();
    const target = delta > 0 ? 365 : 235;
    const i = this.menu_items.findIndex(it => it.role === 'bj_slider' && Math.abs(it.cx - target) < 1);
    if (i >= 0) { this.menu_selected_index = i; this.refresh_menu_highlight(); }
  },

  place_blackjack_bet(amount) {
    amount = Math.max(1, Math.min(amount, this.tokens));
    this.bj_bet = amount;
    this.tokens -= amount;
    this.saveHighScores();
    this.start_blackjack_round();
  },

  start_blackjack_round() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_play_menu();
    this.game_type = 'BLACKJACK';
    this.menu_active = false;

    const suits = ['H','D','C','S'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    this.bj_deck = [];
    for (const s of suits) for (const r of ranks) this.bj_deck.push({ rank:r, suit:s });
    for (let i = this.bj_deck.length-1; i > 0; i--) {          // Fisher-Yates
      const j = Math.floor(Math.random()*(i+1));
      [this.bj_deck[i], this.bj_deck[j]] = [this.bj_deck[j], this.bj_deck[i]];
    }

    this.bj_player_hand = [this.bj_deck.pop(), this.bj_deck.pop()];
    this.bj_dealer_hand = [this.bj_deck.pop(), this.bj_deck.pop()];

    this.draw_token_header(theme);
    this.animate_blackjack_deal(0);
  },

  // Deals one card at a time, dealer first, like a real table.
  animate_blackjack_deal(step) {
    const theme = this.get_theme();
    this.canvas.delete('game_elements');
    this.draw_token_header(theme);

    this.draw_blackjack_board(true, Math.min(step,2), Math.max(0, Math.min(step-2,2)));

    if (step < 4) {
      this.play_sound('click');
      this.game_job = setTimeout(() => this.animate_blackjack_deal(step+1), 320);
    } else if (this.calculate_blackjack_score(this.bj_player_hand) === 21) {
      this.resolve_blackjack_game(false);
    } else {
      this.menu_active = true;
      this.draw_blackjack_action_buttons(theme, this.tokens >= this.bj_bet);
    }
  },

  calculate_blackjack_score(hand) {
    let total = 0, aces = 0;
    for (const c of hand) {
      if (['J','Q','K'].includes(c.rank)) total += 10;
      else if (c.rank === 'A') { aces++; total += 11; }
      else total += parseInt(c.rank, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  },

  draw_blackjack_board(hide_dealer=true, dealer_count=null, player_count=null) {
    const theme = this.get_theme();
    this.canvas.delete('game_elements');

    const dFull = this.bj_dealer_hand, pFull = this.bj_player_hand;
    const dCards = dealer_count === null ? dFull : dFull.slice(0, dealer_count);
    const pCards = player_count === null ? pFull : pFull.slice(0, player_count);

    this.canvas.create_text(100,70,{ text:`CREDITS: ${this.format_tokens(this.tokens)}`, fill:YELLOW, font:['Arial',12,'bold'], tags:['game_elements'] });
    this.canvas.create_text(500,70,{ text:`BET: ${this.format_tokens(this.bj_bet)}`, fill:WHITE, font:['Arial',12,'bold'], tags:['game_elements'] });

    this.canvas.create_text(300,92,{ text:'DEALER HAND', fill:theme.muted, font:['Helvetica Neue',12,'bold'], tags:['game_elements'] });
    let dText;
    if (!dCards.length) dText = '-';
    else if (hide_dealer && dFull.length >= 2) dText = `${this.calculate_blackjack_score(dCards.slice(0,1))} + ?`;
    else dText = String(this.calculate_blackjack_score(dCards));
    this.canvas.create_text(300,115,{ text:`Score: ${dText}`, fill:theme.text, font:['Helvetica Neue',12], tags:['game_elements'] });

    let sx = 300 - dFull.length*35;
    dCards.forEach((card,i) => this.draw_card_graphic(sx + i*70, 170, card, hide_dealer && i === 1));

    this.canvas.create_text(300,270,{ text:'YOUR HAND', fill:theme.muted, font:['Helvetica Neue',12,'bold'], tags:['game_elements'] });
    const pText = pCards.length ? String(this.calculate_blackjack_score(pCards)) : '-';
    this.canvas.create_text(300,295,{ text:`Score: ${pText}`, fill:theme.text, font:['Helvetica Neue',12], tags:['game_elements'] });

    let px = 300 - pFull.length*35;
    pCards.forEach((card,i) => this.draw_card_graphic(px + i*70, 370, card, false));
  },

  draw_card_graphic(cx, cy, card, hidden=false) {
    const w = 60, h = 85;
    const x1 = cx-w/2, y1 = cy-h/2, x2 = cx+w/2, y2 = cy+h/2;
    if (hidden) {
      this.rounded_rect(x1,y1,x2,y2,6,{ fill:'#1e293b', outline:'#cbd5e1', width:2, tags:['game_elements'] });
      this.canvas.create_text(cx,cy,{ text:'DIZZY', fill:'#94a3b8', font:['Arial',10,'bold'], tags:['game_elements'] });
      return;
    }
    this.rounded_rect(x1,y1,x2,y2,6,{ fill:WHITE, outline:'#cbd5e1', width:2, tags:['game_elements'] });
    const color = ['H','D'].includes(card.suit) ? RED : BLACK;
    this.canvas.create_text(x1+12, y1+12, { text:card.rank, fill:color, font:['Arial',11,'bold'], tags:['game_elements'] });
    const sym = { H:'♥', D:'♦', C:'♣', S:'♠' }[card.suit];
    this.canvas.create_text(cx, cy+5, { text:sym, fill:color, font:['Arial',24], tags:['game_elements'] });
  },

  draw_blackjack_action_buttons(theme, allow_double) {
    this.canvas.delete('bj_actions');
    this.menu_items = this.menu_items.filter(m => m.group !== 'bj_actions');

    const positions = allow_double
      ? [['HIT', () => this.bj_hit(), 130], ['STAND', () => this.bj_stand(), 300], ['DOUBLE', () => this.bj_double_down(), 470]]
      : [['HIT', () => this.bj_hit(), 220], ['STAND', () => this.bj_stand(), 380]];

    for (const [label, cmd, cx] of positions) {
      const tag = `bj_act_${label}`;
      this.rounded_rect(cx-70, 495, cx+70, 540, 10,
        { fill:theme.bg, outline:theme.accent, width:2, tags:['bj_actions', tag] });
      this.canvas.create_text(cx, 517, { text:label, fill:theme.accent, font:['Helvetica Neue',13,'bold'], tags:['bj_actions', tag] });
      const idx = this.menu_items.length;
      this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx, cy:517, w:140, h:45, command:cmd, group:'bj_actions' });
    }
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },

  bj_hit() {
    this.play_sound('click');
    this.bj_player_hand.push(this.bj_deck.pop());
    this.draw_blackjack_board(true);
    if (this.calculate_blackjack_score(this.bj_player_hand) > 21) this.resolve_blackjack_game(true);
    else this.draw_blackjack_action_buttons(this.get_theme(), false);
  },

  bj_stand() {
    this.play_sound('click');
    this.resolve_blackjack_game(false);
  },

  bj_double_down() {
    if (this.tokens < this.bj_bet) return;
    this.play_sound('click');
    this.tokens -= this.bj_bet;
    this.bj_bet *= 2;
    this.saveHighScores();
    this.bj_player_hand.push(this.bj_deck.pop());
    this.draw_blackjack_board(true);
    this.resolve_blackjack_game(this.calculate_blackjack_score(this.bj_player_hand) > 21);
  },

  resolve_blackjack_game(forced_loss=false) {
    this.menu_active = false;
    this.canvas.delete('bj_actions');
    this.menu_items = [];

    const p = this.calculate_blackjack_score(this.bj_player_hand);
    if (!forced_loss)
      while (this.calculate_blackjack_score(this.bj_dealer_hand) < 17)
        this.bj_dealer_hand.push(this.bj_deck.pop());
    const d = this.calculate_blackjack_score(this.bj_dealer_hand);

    this.draw_blackjack_board(false);

    let payout = 0, is_win = false, is_push = false, outcome;
    if (forced_loss || p > 21) outcome = 'BUST! YOU LOSE';
    else if (d > 21) { outcome = 'DEALER BUST! YOU WIN!'; payout = this.bj_bet*2; is_win = true; }
    else if (p > d)  { outcome = 'YOU WIN!'; payout = this.bj_bet*2; is_win = true; }
    else if (p < d)  outcome = 'DEALER WINS';
    else { outcome = 'PUSH (TIE)'; payout = this.bj_bet; is_push = true; }

    if (payout > 0) this.add_tokens(payout);
    if (this.tokens > (this.high_scores.BLACKJACK ?? 0)) {
      this.high_scores.BLACKJACK = this.tokens;
      this.saveHighScores();
    }

    const theme = this.get_theme();
    if (is_win) {
      const profit = payout - this.bj_bet;
      this.play_sound('fanfare');
      this.show_bj_result_popup(theme, true,
        `+${this.format_tokens(payout)}  (bet ${this.format_tokens(this.bj_bet)} + profit ${this.format_tokens(profit)})`);
    } else if (is_push) {
      this.canvas.create_text(300,460,{ text:'PUSH — BET RETURNED', fill:YELLOW, font:['Helvetica Neue',20,'bold'], tags:['game_elements'] });
      this.make_menu_item('PLAY AGAIN', () => this.start_blackjack_betting(), theme, 200, 535, 160, 40);
      this.make_menu_item('EXIT', () => this.show_play_menu(), theme, 400, 535, 160, 40);
      this.menu_active = true;
      this.menu_selected_index = 0;
      this.refresh_menu_highlight();
    } else {
      this.play_sound('lose');
      this.show_bj_result_popup(theme, false, `-${this.format_tokens(this.bj_bet)}`);
    }
  },

  show_bj_result_popup(theme, win, amount_text) {
    this.canvas.delete('bj_popup');
    const color = win ? GREEN : RED;
    const label = win ? 'WINNER!' : 'YOU LOSE';

    this.canvas.create_rectangle(0,0,600,600,{ fill:'rgba(0,0,0,0.55)', outline:'', tags:['bj_popup'] });
    this.rounded_rect(90,190,510,410,20,{ fill:'#101014', outline:color, width:3, tags:['bj_popup'] });
    this.canvas.create_text(300,250,{ text:label, fill:color, font:['Impact',42], tags:['bj_popup'] });
    this.canvas.create_text(300,312,{ text:amount_text, fill:color, font:['Helvetica Neue',15,'bold'], tags:['bj_popup'] });
    this.canvas.create_text(300,368,{ text:'TAP TO PLAY AGAIN', fill:theme.text, font:['Helvetica Neue',12], tags:['bj_popup'] });

    this.menu_items = [];
    const cmd = () => this.start_blackjack_betting();
    this.canvas.tag_bind('bj_popup', '<Button-1>', () => this.handle_click(cmd));
    this.menu_items.push({ type:'custom', cx:300, cy:300, w:420, h:220, command:cmd });
    this.menu_active = true;
    this.menu_selected_index = 0;
  },
});

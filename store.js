// store.js — the token/energy store: themes, skins, premium, levels, boosts.

Object.assign(ArcadeApp.prototype, {

  format_price(n) {
    n = Math.floor(n);
    if (n >= 1000000 && n % 1000000 === 0) return `${n/1000000}M`;
    if (n >= 1000 && n % 1000 === 0) return `${n/1000}K`;
    if (n >= 1000) return n.toLocaleString('en-US');
    return String(n);
  },

  select_store_tab(tab_key) { this.store_tab = tab_key; this.show_store_menu(); },

  store_error(msg) {
    const id = this.canvas.create_text(300, 585, { text:msg, fill:RED, font:['Arial',12,'bold'] });
    setTimeout(() => { const it = this.canvas.find(id); if (it) this.canvas.items.splice(this.canvas.items.indexOf(it),1); }, 1500);
  },

  build_store_row(theme, opts) {
    const { label, label_y, row_cy, entries, icon_fn, buy_cmd_fn,
            card_h = 76, title_fn = null, currency = 'tokens',
            label_color = null, card_w = 130, rare = false, icon_offset_y = 20 } = opts;

    this.canvas.create_text(70, label_y, { text:label, fill: label_color || theme.accent,
      font:['Helvetica Neue',12,'bold'], anchor:'w' });

    if (!entries.length) {
      this.canvas.create_text(300, row_cy, { text:'All items in this set are unlocked!',
        fill:theme.muted, font:['Arial',10,'italic'] });
      return;
    }

    const spacing = card_w + 20;
    const offset = -(entries.length - 1) / 2 * spacing;
    const balance = currency === 'tokens' ? this.tokens : this.energy;
    const currency_label = currency === 'tokens' ? 'TOKENS' : 'ENERGY';
    const currency_color = currency === 'tokens' ? YELLOW : PURPLE;

    entries.forEach(([key, price], i) => {
      const cx = 300 + offset + i*spacing;
      const tag = `store_card_${label}_${key}`.replace(/\s/g,'_');
      const afford = balance >= price;
      const outline_color = rare ? (afford ? '#f59e0b' : RED) : (afford ? theme.muted : RED);
      const border_width = rare ? 3 : 1;

      this.rounded_rect(cx-card_w/2, row_cy-card_h/2, cx+card_w/2, row_cy+card_h/2, 10,
        { fill:theme.bg, outline:outline_color, width:border_width, tags:[tag] });

      if (rare)
        this.canvas.create_text(cx, row_cy-card_h/2+16, { text:'★ RARE ★', fill:'#f59e0b',
          font:['Arial',9,'bold'], tags:[tag] });

      let price_y;
      if (title_fn) {
        icon_fn(cx, row_cy-card_h/2+icon_offset_y, key, tag);
        this.canvas.create_text(cx, row_cy + (rare ? 18 : 2), { text:title_fn(key), fill:theme.text,
          font:['Arial', rare ? 11 : 9, 'bold'], tags:[tag] });
        price_y = row_cy + card_h/2 - 14;
      } else {
        icon_fn(cx, row_cy-8, key, tag);
        price_y = row_cy + card_h/2 - 10;
      }

      this.canvas.create_text(cx, price_y, { text:`${this.format_price(price)} ${currency_label}`,
        fill:currency_color, font:['Helvetica Neue', rare ? 12 : 10, 'bold'], tags:[tag] });

      const cmd = () => buy_cmd_fn(key);
      const idx = this.menu_items.length;
      this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx, cy:row_cy, w:card_w, h:card_h, command:cmd });
    });
  },

  build_multiplier_row(theme, label_y, row_cy) {
    this.canvas.create_text(300, label_y, { text:'SCORE MULTIPLIERS', fill:theme.accent, font:['Helvetica Neue',13,'bold'] });

    const entries = Object.entries(STORE_MULTIPLIER_ITEMS);
    const spacing = 170;
    const offset = -(entries.length - 1) / 2 * spacing;
    const card_w = 150, card_h = 92;
    const active_mult = this.get_active_multiplier();

    entries.forEach(([key, data], i) => {
      const cx = 300 + offset + i*spacing;
      const tag = `store_mult_${key}`;
      const afford = this.tokens >= data.price;
      const is_active = active_mult > 1 && active_mult === data.mult;
      const outline = is_active ? GREEN : (afford ? theme.muted : RED);

      this.rounded_rect(cx-card_w/2, row_cy-card_h/2, cx+card_w/2, row_cy+card_h/2, 12,
        { fill:theme.bg, outline, width: is_active ? 2 : 1, tags:[tag] });
      this.canvas.create_text(cx, row_cy-26, { text:`${data.mult}x SCORE`, fill:theme.text, font:['Arial',15,'bold'], tags:[tag] });
      const mins = Math.floor(data.duration/60), secs = data.duration % 60;
      this.canvas.create_text(cx, row_cy, { text: secs === 0 ? `${mins}m` : `${mins}m ${secs}s`,
        fill:theme.muted, font:['Arial',11], tags:[tag] });
      this.canvas.create_text(cx, row_cy+28, { text:`${data.price.toLocaleString('en-US')} TOKENS`,
        fill:YELLOW, font:['Helvetica Neue',11,'bold'], tags:[tag] });

      const cmd = () => this.buy_multiplier_item(key);
      const idx = this.menu_items.length;
      this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx, cy:row_cy, w:card_w, h:card_h, command:cmd });
    });

    if (active_mult > 1) {
      const rem = Math.max(0, Math.floor(this.multiplier_expiry - Date.now()/1000));
      this.canvas.create_text(300, row_cy + card_h/2 + 24,
        { text:`ACTIVE: ${active_mult}x SCORE — ${Math.floor(rem/60)}:${String(rem%60).padStart(2,'0')} left`,
          fill:GREEN, font:['Helvetica Neue',11,'bold'] });
    }
  },

  // --- purchases ----------------------------------------------------------
  buy_theme_item(hue) {
    const price = STORE_THEME_ITEMS[hue] ?? 0;
    if (this.tokens < price) return this.store_error('NOT ENOUGH TOKENS!');
    this.tokens -= price;
    if (!this.unlocked_themes.includes(hue)) this.unlocked_themes.push(hue);
    this.saveHighScores();
    this.show_store_menu();
  },

  buy_energy_theme_item(hue) {
    const price = STORE_ENERGY_THEME_ITEMS[hue] ?? 0;
    if (this.energy < price) return this.store_error('NOT ENOUGH ENERGY!');
    this.energy -= price;
    if (!this.unlocked_themes.includes(hue)) this.unlocked_themes.push(hue);
    this.saveHighScores();
    this.show_store_menu();
  },

  buy_snake_item(item_id) {
    const item = STORE_SNAKE_ITEMS[item_id] ?? {};
    const price = item.price ?? 0;
    const currency = item.currency ?? 'tokens';
    const balance = currency === 'energy' ? this.energy : this.tokens;
    if (balance < price) return this.store_error(currency === 'energy' ? 'NOT ENOUGH ENERGY!' : 'NOT ENOUGH TOKENS!');
    if (currency === 'energy') this.energy -= price; else this.tokens -= price;
    if (!this.unlocked_snakes.includes(item_id)) this.unlocked_snakes.push(item_id);
    if (this.active_snake_id === null) this.active_snake_id = item_id;
    this.saveHighScores();
    this.show_store_menu();
  },

  buy_flappy_item(item_id) {
    const price = STORE_FLAPPY_ITEMS[item_id]?.price ?? 0;
    if (this.tokens < price) return this.store_error('NOT ENOUGH TOKENS!');
    this.tokens -= price;
    if (!this.unlocked_flappy.includes(item_id)) this.unlocked_flappy.push(item_id);
    if (this.active_flappy_id === null) this.active_flappy_id = item_id;
    this.saveHighScores();
    this.show_store_menu();
  },

  buy_si_item(item_id) {
    const price = STORE_SI_ITEMS[item_id]?.price ?? 0;
    if (this.tokens < price) return this.store_error('NOT ENOUGH TOKENS!');
    this.tokens -= price;
    if (!this.unlocked_si.includes(item_id)) this.unlocked_si.push(item_id);
    if (this.active_si_id === null) this.active_si_id = item_id;
    this.saveHighScores();
    this.show_store_menu();
  },

  buy_level_item(level_id) {
    const price = STORE_LEVEL_ITEMS[level_id]?.price ?? 0;
    if (this.tokens < price) return this.store_error('NOT ENOUGH TOKENS!');
    this.tokens -= price;
    if (!this.unlocked_levels.includes(level_id)) this.unlocked_levels.push(level_id);
    this.saveHighScores();
    this.show_store_menu();
  },

  buy_multiplier_item(item_id) {
    const data = STORE_MULTIPLIER_ITEMS[item_id];
    if (!data) return;
    if (this.tokens < data.price) return this.store_error('NOT ENOUGH TOKENS!');
    this.tokens -= data.price;
    this.active_multiplier = data.mult;
    this.multiplier_expiry = Date.now()/1000 + data.duration;
    this.saveHighScores();
    this.show_store_menu();
  },

  // --- the screen ---------------------------------------------------------
  show_store_menu() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_main_menu();
    this.play_sound('menu_open');

    this.draw_token_header(theme);
    this.canvas.create_text(300,76,{ text:'TOKEN STORE', fill:theme.text, font:['Helvetica Neue',24] });

    const tabs = ['THEMES','SKINS','PREMIUM','LEVELS','BOOSTS'];
    const spacing = 108;
    const offset = -(tabs.length - 1) / 2 * spacing;
    tabs.forEach((key, i) => {
      const cx = 300 + offset + i*spacing;
      const tag = `store_tab_${key}`;
      const active = this.store_tab === key;
      this.rounded_rect(cx-48, 96, cx+48, 128, 16,
        { fill: active ? theme.accent : theme.bg,
          outline: active ? theme.accent : theme.muted, width:1, tags:[tag] });
      this.canvas.create_text(cx, 112, { text:key, fill: active ? theme.bg : theme.muted,
        font:['Helvetica Neue',11,'bold'], tags:[tag] });
      const cmd = () => this.select_store_tab(key);
      const idx = this.menu_items.length;
      this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx, cy:112, w:96, h:32, command:cmd });
    });

    const swatch = (cx,cy,key,tag) => this.canvas.create_oval(cx-18, cy-18, cx+18, cy+18,
      { fill:THEME_HUES[key].swatch, outline:'', tags:[tag] });

    if (this.store_tab === 'THEMES') {
      this.build_store_row(theme, { label:'AVAILABLE THEMES', label_y:150, row_cy:210,
        entries: Object.entries(STORE_THEME_ITEMS).filter(([h]) => !this.unlocked_themes.includes(h)),
        icon_fn: swatch, buy_cmd_fn: k => this.buy_theme_item(k), card_h:80 });
      this.build_store_row(theme, { label:'ENERGY THEMES', label_y:290, row_cy:350,
        entries: Object.entries(STORE_ENERGY_THEME_ITEMS).filter(([h]) => !this.unlocked_themes.includes(h)),
        icon_fn: swatch, buy_cmd_fn: k => this.buy_energy_theme_item(k), card_h:80,
        currency:'energy', label_color:PURPLE });

    } else if (this.store_tab === 'SKINS') {
      this.build_store_row(theme, { label:'SNAKE HEADS', label_y:150, row_cy:180,
        entries: Object.entries(STORE_SNAKE_ITEMS)
          .filter(([id,d]) => !d.head_pattern && !this.unlocked_snakes.includes(id))
          .map(([id,d]) => [id, d.price]),
        icon_fn: (cx,cy,key,tag) => this.draw_snake_icon_smart(cx, cy, STORE_SNAKE_ITEMS[key], tag),
        buy_cmd_fn: k => this.buy_snake_item(k), card_h:56 });
      this.build_store_row(theme, { label:'FLAPPY HEADS', label_y:234, row_cy:264,
        entries: Object.entries(STORE_FLAPPY_ITEMS)
          .filter(([id]) => !this.unlocked_flappy.includes(id)).map(([id,d]) => [id, d.price]),
        icon_fn: (cx,cy,key,tag) => this.draw_flappy_icon(cx, cy, STORE_FLAPPY_ITEMS[key].colors, tag),
        buy_cmd_fn: k => this.buy_flappy_item(k), card_h:56 });
      this.build_store_row(theme, { label:'INVADER SKINS', label_y:318, row_cy:348,
        entries: Object.entries(STORE_SI_ITEMS)
          .filter(([id]) => !this.unlocked_si.includes(id)).map(([id,d]) => [id, d.price]),
        icon_fn: (cx,cy,key,tag) => this.draw_si_ship_icon(cx, cy, STORE_SI_ITEMS[key].colors[0], tag, STORE_SI_ITEMS[key].colors[1], 26, 14),
        buy_cmd_fn: k => this.buy_si_item(k), card_h:56 });

    } else if (this.store_tab === 'PREMIUM') {
      this.canvas.create_text(300,148,{ text:'Rare, high-detail pixel-art skins', fill:theme.muted, font:['Arial',11,'italic'] });
      const premium = cur => Object.entries(STORE_SNAKE_ITEMS)
        .filter(([id,d]) => d.head_pattern && (d.currency ?? 'tokens') === cur && !this.unlocked_snakes.includes(id))
        .map(([id,d]) => [id, d.price]);
      this.build_store_row(theme, { label:'PREMIUM (TOKENS)', label_y:163, row_cy:228,
        entries: premium('tokens'),
        icon_fn: (cx,cy,key,tag) => this.draw_snake_icon_smart(cx, cy, STORE_SNAKE_ITEMS[key], tag, 26),
        buy_cmd_fn: k => this.buy_snake_item(k), card_h:120, card_w:140,
        title_fn: k => STORE_SNAKE_ITEMS[k].name ?? k.toUpperCase(), rare:true, icon_offset_y:38 });
      this.build_store_row(theme, { label:'PREMIUM (ENERGY)', label_y:300, row_cy:365,
        entries: premium('energy'),
        icon_fn: (cx,cy,key,tag) => this.draw_snake_icon_smart(cx, cy, STORE_SNAKE_ITEMS[key], tag, 26),
        buy_cmd_fn: k => this.buy_snake_item(k), card_h:120, card_w:140,
        title_fn: k => STORE_SNAKE_ITEMS[k].name ?? k.toUpperCase(), rare:true, icon_offset_y:38,
        currency:'energy', label_color:PURPLE });

    } else if (this.store_tab === 'LEVELS') {
      this.build_store_row(theme, { label:'UNLOCKABLE GAME LEVELS', label_y:170, row_cy:260,
        entries: Object.entries(STORE_LEVEL_ITEMS)
          .filter(([id]) => !this.unlocked_levels.includes(id)).map(([id,d]) => [id, d.price]),
        icon_fn: (cx,cy,key,tag) => this.draw_level_icon(cx, cy, key, tag, 4),
        buy_cmd_fn: k => this.buy_level_item(k), card_h:110,
        title_fn: k => LEVEL_TITLES[k] ?? k.toUpperCase() });

    } else {
      this.build_multiplier_row(theme, 170, 260);
    }

    this.make_menu_item('< MAIN MENU', () => this.show_main_menu(), theme, 300, 470, 200, 34);
    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },
});

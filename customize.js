// customize.js — equip screen for snake, flappy and invader skins.

Object.assign(ArcadeApp.prototype, {

  // Default slot plus the unlocked items, in one compact row that fits
  // regardless of how many have been purchased.
  build_customize_grid(theme, cy, opts) {
    const { default_icon, default_selected, default_cmd, unlocked_ids,
            store_items, active_id, icon_fn, select_cmd_fn, empty_text } = opts;
    const total_slots = 1 + unlocked_ids.length;
    const spacing = 130;
    const offset = -(total_slots - 1) / 2 * spacing;
    const card_w = 104, card_h = 96;

    const render_card = (cx, selected, icon_draw, label, cmd, tag) => {
      this.rounded_rect(cx-card_w/2, cy-card_h/2, cx+card_w/2, cy+card_h/2, 10,
        { fill:theme.bg, outline: selected ? theme.accent : theme.muted, width:2, tags:[tag] });
      icon_draw(cx, cy-12, tag);
      this.canvas.create_text(cx, cy+32, { text: selected ? 'ACTIVE' : label,
        fill: selected ? GREEN : theme.text, font:['Arial',9,'bold'], tags:[tag] });
      const idx = this.menu_items.length;
      this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx, cy, w:card_w, h:card_h, command:cmd });
    };

    render_card(300 + offset, default_selected, default_icon, 'DEFAULT', default_cmd, 'cust_default');

    unlocked_ids.forEach((item_id, i) => {
      const data = store_items[item_id];
      render_card(300 + offset + (i+1)*spacing, active_id === item_id,
        (cx_, cy_, tag) => icon_fn(cx_, cy_, data, tag),
        'EQUIP', () => select_cmd_fn(item_id), `cust_item_${item_id}`);
    });

    if (!unlocked_ids.length)
      this.canvas.create_text(300, cy+75, { text:empty_text, fill:theme.muted, font:['Arial',11] });
  },

  select_customize_tab(tab_key) { this.customize_tab = tab_key; this.show_customize_menu(); },
  select_custom_snake(id)  { this.active_snake_id = id;  this.saveHighScores(); this.show_customize_menu(); },
  select_custom_flappy(id) { this.active_flappy_id = id; this.saveHighScores(); this.show_customize_menu(); },
  select_custom_si(id)     { this.active_si_id = id;     this.saveHighScores(); this.show_customize_menu(); },

  show_customize_menu() {
    this.clear_screen();
    const theme = this.get_theme();
    this.canvas.configure({ bg: theme.bg });
    this.esc_back_command = () => this.show_main_menu();
    this.play_sound('menu_open');

    this.draw_token_header(theme);
    this.canvas.create_text(300,78,{ text:'CUSTOMIZE', fill:theme.text, font:['Helvetica Neue',30] });

    for (const [key, label, cx] of [['SNAKE','SNAKE',120], ['FLAPPY','FLAPPY',300], ['SPACE','INVADERS',480]]) {
      const tag = `cust_tab_${key}`;
      const active = this.customize_tab === key;
      this.rounded_rect(cx-70, 104, cx+70, 136, 16,
        { fill: active ? theme.accent : theme.bg,
          outline: active ? theme.accent : theme.muted, width:1, tags:[tag] });
      this.canvas.create_text(cx, 120, { text:label,
        fill: active ? theme.bg : theme.muted, font:['Helvetica Neue',12,'bold'], tags:[tag] });
      const cmd = () => this.select_customize_tab(key);
      const idx = this.menu_items.length;
      this.canvas.tag_bind(tag, '<Button-1>', () => this.handle_click(cmd));
      this.canvas.tag_bind(tag, '<Enter>', () => this.set_menu_selection(idx));
      this.menu_items.push({ type:'custom', cx, cy:120, w:140, h:32, command:cmd });
    }

    if (this.customize_tab === 'SNAKE') {
      this.build_customize_grid(theme, 250, {
        default_icon: (cx,cy,tag) => this.draw_snake_icon(cx, cy, [GREEN, theme.secondary], tag),
        default_selected: this.active_snake_id === null,
        default_cmd: () => this.select_custom_snake(null),
        unlocked_ids: this.unlocked_snakes,
        store_items: STORE_SNAKE_ITEMS,
        active_id: this.active_snake_id,
        icon_fn: (cx,cy,item,tag) => this.draw_snake_icon_smart(cx, cy, item, tag),
        select_cmd_fn: id => this.select_custom_snake(id),
        empty_text: 'Buy custom snake skins in the Store!',
      });
    } else if (this.customize_tab === 'FLAPPY') {
      this.build_customize_grid(theme, 250, {
        default_icon: (cx,cy,tag) => this.draw_flappy_icon(cx, cy, [YELLOW], tag),
        default_selected: this.active_flappy_id === null,
        default_cmd: () => this.select_custom_flappy(null),
        unlocked_ids: this.unlocked_flappy,
        store_items: STORE_FLAPPY_ITEMS,
        active_id: this.active_flappy_id,
        icon_fn: (cx,cy,item,tag) => this.draw_flappy_icon(cx, cy, item.colors, tag),
        select_cmd_fn: id => this.select_custom_flappy(id),
        empty_text: 'Buy Flappy Bird skins in the Store!',
      });
    } else {
      this.build_customize_grid(theme, 250, {
        default_icon: (cx,cy,tag) => this.draw_si_ship_icon(cx, cy, theme.accent, tag, YELLOW),
        default_selected: this.active_si_id === null,
        default_cmd: () => this.select_custom_si(null),
        unlocked_ids: this.unlocked_si,
        store_items: STORE_SI_ITEMS,
        active_id: this.active_si_id,
        icon_fn: (cx,cy,item,tag) => this.draw_si_ship_icon(cx, cy, item.colors[0], tag, item.colors[1]),
        select_cmd_fn: id => this.select_custom_si(id),
        empty_text: 'Buy Space Invader skins in the Store!',
      });
    }

    this.make_menu_item('< MAIN MENU', () => this.show_main_menu(), theme, 300, 460, 200);
    this.menu_active = true;
    this.menu_selected_index = 0;
    this.refresh_menu_highlight();
  },
});

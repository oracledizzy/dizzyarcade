# Dizzy Arcade (web)

A browser port of the Dizzy Arcade desktop game, playable on a phone.

The original is a ~4,400-line Python/tkinter app. tkinter cannot run on iOS,
so the rendering and input layers were rewritten rather than wrapped:

- `tkcanvas.js` — a tkinter Canvas work-alike over an HTML5 canvas, so the
  game logic ports across with its original drawing calls intact.
- `audio.js` — the sound effects are generated in the browser with the same
  sample-loop maths the Python build used to write its `.wav` files, so no
  effect audio ships at all. Only music is a real download.
- `game.js` — app shell: state, themes, menus, persistence via localStorage.
- `snake.js` / `flappy.js` — the two ported games.

## Controls

Touch is primary: swipe to turn in Snake, tap to flap in Flappy, tap the
MENU chip to quit a run. Arrow keys, space and Escape still work on desktop.

## Not yet ported

Pong, Space Invaders, Sword Arena, Blackjack, and the Store / Customize /
Other screens are stubs. `starwars_music` is omitted until Space Invaders
lands.

## Running locally

    python3 -m http.server 8777

then open http://localhost:8777

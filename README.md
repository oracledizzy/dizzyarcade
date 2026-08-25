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

## Layout

The game was authored for a fixed 600x600 window. Here the width stays 600 —
so every x-coordinate ported unchanged — while the height is whatever the
device gives, exposed as `canvas.VH`. Menus lay themselves out down the full
screen; games keep their original 600-tall playfield (stretching it would
change Snake's grid and Flappy's gap tuning) and are positioned near the top
via `canvas.originY`, leaving the space below for thumbs. Notch and
home-indicator insets are read from `env(safe-area-inset-*)`.

Feel and layout constants live in `tuning.js`.

## Controls

Touch is primary: swipe to turn in Snake, tap to flap in Flappy, tap the
MENU chip to quit a run. Arrow keys, space and Escape still work on desktop.

## Games

All nine modes are playable: Snake (Infinite, Levels 1-99, Esoteric), Flappy
Bird (standard and Alt Dimension), Pong, Space Invaders, Sword Arena, and
Blackjack.

Touch schemes are new work rather than ports, since every input in the
desktop build was a key:

| Mode | Control |
|---|---|
| Snake, Snake Levels, Esoteric | swipe to turn |
| Flappy, Alt Dimension | tap to flap |
| Pong | each player drags on their own half |
| Space Invaders | drag to move, fires automatically |
| Sword Arena | virtual joystick, held attack pad |
| Blackjack | buttons |

## Screens

Everything from the desktop build is here: main menu, game select, the Snake
and Flappy mode trees, Settings, Customize (3 tabs), the Store (5 tabs, two
currencies), the Other/credits screen, and the password-gated cheat menu
behind its hidden star.

The cheat menu's text fields are real HTML inputs floated over the canvas,
since a canvas cannot draw an editable field. Note that a browser game keeps
no secrets — the cheat password is readable in the shipped source.

## Running locally

    python3 -m http.server 8777

then open http://localhost:8777

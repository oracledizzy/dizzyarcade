// tuning.js — every value worth tweaking to change how the game feels.
// Loaded before everything else, so edit here rather than hunting through
// the game loops.

// --- Snake (Infinite and Esoteric share these) ----------------------------
// Tick length in milliseconds; lower is faster. The desktop original used
// 100. A phone shows the same field physically smaller, so the same speed
// reads as slower — 82 restores the intended pace on a handset.
const SNAKE_START_MS = 82;
const SNAKE_MIN_MS   = 48;    // fastest the snake can get after coin pickups
const SNAKE_STEP_MS  = 1.5;   // how much each collected coin speeds it up

// Snake Levels starts from its own pace, which tightens as levels climb.
// Scaled to match SNAKE_START_MS so the campaign feels like the same game
// (the desktop original was 100 down to a floor of 60).
const SNAKE_LEVEL_START_MS = 82;
const SNAKE_LEVEL_FLOOR_MS = 50;
const SNAKE_LEVEL_RAMP     = 0.29;   // ms shaved off the start per level

// --- Touch feel -----------------------------------------------------------
// Finger travel, in screen pixels, before a drag counts as a swipe.
// Lower = twitchier. The turn fires the instant this is crossed.
const SWIPE_MIN_PX   = 16;

// How many turns may be queued ahead of the current one. 2 means a fast
// right-then-down lands both instead of the second eating the first.
const TURN_QUEUE_MAX = 2;

// --- Menu layout ----------------------------------------------------------
// Item height in design units. On a phone the 600-wide column scales by
// roughly 0.62, so 72 lands at about 45pt — just over Apple's 44pt minimum.
// The desktop original used 46, which came out at 30pt and felt fiddly.
const MENU_ITEM_H  = 72;
const MENU_GAP     = 16;    // vertical space between items
const MENU_FONT    = 17;    // label size (was 14)
const MENU_ITEM_W  = 300;   // wider now that there is room for it

// Where a game's 600-tall playfield sits in the taller viewport: 0 pins it
// to the top, 1 to the bottom. Kept near the top so the HUD sits at the
// screen edge and all the leftover room falls below the field, which is
// where your thumb rests and where the swipes happen.
const GAME_FIELD_BIAS = 0.06;


export const TILE_SIZE = 40;
export const PLAYER_RADIUS = 12;
export const ENEMY_RADIUS = 14;

// Movement & Physics
export const PLAYER_SPEED_WALK = 3.5;
export const PLAYER_SPEED_SPRINT = 6.0;
export const PLAYER_MAX_STAMINA = 100;
export const STAMINA_DRAIN = 1.5;
export const STAMINA_REGEN = 0.5;

export const ENEMY_SPEED = 2.0;
export const ENEMY_SPEED_CHASE = 4.0;

// Gadgets
export const EMP_RADIUS = 300;
export const EMP_DURATION = 300; // Frames (approx 5 sec)
export const EMP_COOLDOWN = 600; // Frames (approx 10 sec)

export const DECOY_RADIUS = 400; // Sound range
export const DECOY_DURATION = 180;
export const DECOY_COOLDOWN = 400;

// Colors
export const COLORS = {
  BACKGROUND: '#0a0a0a',
  WALL: '#111111',
  WALL_BORDER: '#003300', // Matrix green hint
  PLAYER_1: '#00BFFF', // Neon Blue
  PLAYER_2: '#00FF7F', // Spring Green
  ENEMY: '#FF3333',
  ENEMY_VISION: 'rgba(255, 50, 50, 0.2)',
  ENEMY_FLASHLIGHT: 'rgba(255, 255, 200, 0.4)',
  LIGHT_ON: 'rgba(255, 255, 200, 0.1)',
  LIGHT_CORE: 'rgba(255, 255, 200, 0.6)',
  SWITCH_OFF: '#444444',
  SWITCH_ON: '#00BFFF',
  LORE: '#C084FC', // Purple
  EXIT: '#FFFFFF',
  NOISE_RING: 'rgba(255, 255, 255, 0.3)',
  RADAR_BG: 'rgba(0, 20, 0, 0.8)',
  RADAR_DOT: '#00FF00'
};

export const LORE_TEXTS = [
  "Entry 001: The facility's automated defenses are sensitive to movement in light.",
  "Entry 024: They say the shadows themselves are alive, or maybe that's just the isolation talking.",
  "Entry 042: The guards follow strict patterns. Predictable, but deadly.",
  "Entry 108: Power switches are networked. One flip can darken an entire corridor.",
  "Entry 256: I found the exit codes, but the path is blocked by searchlights.",
  "Final Entry: If you are reading this, I didn't make it out. Stay in the dark."
];
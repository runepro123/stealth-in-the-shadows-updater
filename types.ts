
export type Point = { x: number; y: number };

// --- ELECTRON TYPES ---
export interface ElectronAPI {
  onUpdateStatus: (callback: (data: { status: string; msg: string }) => void) => () => void;
  onUpdateProgress: (callback: (data: { percent: number; speed: number; transferred: number; total: number }) => void) => () => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export enum EntityType {
  PLAYER,
  ENEMY,
  WALL,
  LIGHT,
  SWITCH,
  EXIT,
  LORE
}

export enum GameStatus {
  MENU,
  CUTSCENE, // New status for Drone Flyover
  DIALOG,
  PLAYING,
  PAUSED,
  GAME_OVER_CAUGHT,
  LEVEL_COMPLETE,
  VICTORY,
  GAME_ENDING_BAD,
  GAME_ENDING_NEUTRAL,
  GAME_ENDING_GOOD
}

export interface Player {
  id: number;
  pos: Point;
  radius: number;
  color: string;
  keys: { up: string; down: string; left: string; right: string; interact: string; sprint: string; gadget1: string; gadget2: string };
  isAlive: boolean;
  stealthRating: number;
  // Advanced Features
  stamina: number;
  maxStamina: number;
  noiseRadius: number;
  gadgets: {
    emp: { cooldown: number; maxCooldown: number; charges: number };
    decoy: { cooldown: number; maxCooldown: number; charges: number };
  };
}

export interface Enemy {
  id: number;
  pos: Point;
  patrolPath: Point[];
  currentPatrolIndex: number;
  visionAngle: number; // Radians
  visionDistance: number;
  direction: number; // Radians
  radius: number;
  speed: number;
  alertState: 'IDLE' | 'INVESTIGATE' | 'ALERT' | 'CHASE';
  waitTimer: number;
  // Advanced Features
  investigatePos: Point | null; // Where they heard a noise
  suspicionLevel: number; // 0-100
  flashlightOn: boolean;
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LightSource {
  id: number;
  pos: Point;
  radius: number;
  isOn: boolean;
  color: string;
  switchId?: number; 
  disabledTimer?: number; // For EMP
}

export interface Switch {
  id: number;
  pos: Point;
  radius: number;
  isActivated: boolean;
  targets: number[];
}

export interface LoreItem {
  id: number;
  pos: Point;
  text: string;
  collected: boolean;
}

export interface Particle {
  pos: Point;
  vel: Point;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'DUST' | 'SPARK' | 'TEXT' | 'NOISE';
  text?: string; // For floating text
}

export interface Decoy {
  id: number;
  pos: Point;
  life: number;
  active: boolean;
}

export interface LevelData {
  levelNumber: number;
  width: number;
  height: number;
  walls: Wall[];
  enemies: Enemy[];
  lights: LightSource[];
  switches: Switch[];
  lore: LoreItem[];
  exit: Wall;
  playerStart: Point;
  isBossLevel: boolean;
}

export interface GameSave {
  levelNum: number;
  maxLevelReached: number; // Added for Level Selector
  globalStealthRating: number;
  collectedLore: string[];
  mode: 'SINGLE' | 'COOP';
}

export interface DialogLine {
  id: string;
  speaker: string;
  avatar: 'ECHO' | 'AGENT' | 'ARCHITECT' | 'SYSTEM';
  text: string;
  side: 'LEFT' | 'RIGHT' | 'CENTER';
  color: string;
}
import { GameSave } from '../types';

const SAVE_KEY = 'stealth_shadows_save_v1';

export const saveGame = (data: GameSave) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save game", e);
  }
};

export const loadGame = (): GameSave | null => {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load game", e);
    return null;
  }
};

export const clearSave = () => {
  localStorage.removeItem(SAVE_KEY);
};
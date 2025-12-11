import { GameSave } from '../types';

const LOCAL_STORAGE_KEY = 'stealth_shadows_save_v1';

export const saveGame = async (data: GameSave): Promise<void> => {
  try {
    if (window.electron) {
      await window.electron.saveGame(data);
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.error("Failed to save game", e);
  }
};

export const loadGame = async (): Promise<GameSave | null> => {
  try {
    if (window.electron) {
      return await window.electron.loadGame();
    } else {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load game", e);
    return null;
  }
};

export const clearSave = async (): Promise<void> => {
  try {
    if (window.electron) {
      await window.electron.deleteSave();
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch (e) {
    console.error("Failed to clear save", e);
  }
};
import React, { useState, useEffect } from 'react';
import { GameEngine } from './components/GameEngine';
import { UpdateOverlay } from './components/UpdateOverlay';
import { Shield, Users, User, Play, Settings as SettingsIcon, Archive, Grid, Lock, Unlock } from 'lucide-react';
import { loadGame, saveGame } from './utils/saveManager';
import { GameSave } from './types';

type AppMode = 'MENU' | 'GAME_SINGLE' | 'GAME_COOP' | 'LEVEL_SELECT';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('MENU');
  const [saveData, setSaveData] = useState<GameSave | null>(null);

  useEffect(() => {
    // Check for save data on mount and whenever returning to menu
    if (appMode === 'MENU' || appMode === 'LEVEL_SELECT') {
      const data = loadGame();
      setSaveData(data);
    }
  }, [appMode]);

  const handleStartGame = (mode: AppMode, useSave: boolean, specificLevel?: number) => {
      if (useSave && saveData) {
          // If continuing, ensure mode matches save unless overridden
          let targetMode = mode;
          if (mode === 'GAME_SINGLE' && saveData.mode === 'COOP') targetMode = 'GAME_COOP';
          
          if (specificLevel) {
              // Creating a temporary save config to start at specific level
              const tempSave = { ...saveData, levelNum: specificLevel, mode: targetMode === 'GAME_COOP' ? 'COOP' : 'SINGLE' };
              setSaveData(tempSave as GameSave);
          }
          
          setAppMode(targetMode);
      } else {
          setSaveData(null); 
          setAppMode(mode);
      }
  };
  
  const handleCheatUnlock = () => {
      const cheatedSave: GameSave = saveData ? { ...saveData, maxLevelReached: 100 } : {
          levelNum: 1,
          maxLevelReached: 100,
          globalStealthRating: 100,
          collectedLore: [],
          mode: 'SINGLE'
      };
      saveGame(cheatedSave);
      setSaveData(cheatedSave);
  };

  // RENDER CONTENT BASED ON MODE
  const renderContent = () => {
      if (appMode === 'LEVEL_SELECT') {
          const maxReached = saveData?.maxLevelReached || 1;
          return (
            <div className="w-full h-screen bg-[#111] text-white flex flex-col items-center p-8 overflow-hidden font-mono">
                <div className="flex justify-between w-full max-w-6xl mb-6 items-center">
                    <button onClick={() => setAppMode('MENU')} className="px-4 py-2 border border-gray-600 hover:bg-gray-800 rounded">
                        &lt; BACK
                    </button>
                    <h1 className="text-3xl font-bold text-blue-400">LEVEL SELECTOR</h1>
                    <button onClick={handleCheatUnlock} className="px-4 py-2 bg-red-900/50 border border-red-500 hover:bg-red-800 rounded text-red-200 text-xs font-bold tracking-widest animate-pulse">
                        DEV OVERRIDE: UNLOCK ALL
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto w-full max-w-6xl pr-4">
                    <div className="grid grid-cols-10 gap-2">
                        {Array.from({length: 100}, (_, i) => i + 1).map(num => {
                            const locked = num > maxReached;
                            const isBoss = num % 10 === 0;
                            return (
                                <button 
                                    key={num}
                                    disabled={locked}
                                    onClick={() => handleStartGame('GAME_SINGLE', true, num)}
                                    className={`
                                        h-16 rounded flex flex-col items-center justify-center relative border transition-all
                                        ${locked ? 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed' : 'bg-gray-800 border-gray-600 hover:bg-blue-900 hover:border-blue-400 text-white cursor-pointer'}
                                        ${isBoss && !locked ? 'border-red-500 bg-red-900/20' : ''}
                                    `}
                                >
                                    {locked ? <Lock size={16} /> : <span className="text-lg font-bold">{num}</span>}
                                    {isBoss && !locked && <span className="text-[8px] text-red-400 absolute bottom-1">BOSS</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
          );
      }

      if (appMode === 'MENU') {
        return (
          <div className="w-full h-screen bg-[#111] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans">
            {/* Animated Background Effect */}
            <div className="absolute inset-0 z-0">
               <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(0,191,255,0.1),rgba(0,0,0,0.8))]"></div>
            </div>

            <div className="z-10 flex flex-col items-center max-w-2xl text-center">
              <div className="mb-8 p-6 rounded-full bg-blue-500/10 border border-blue-500/30 animate-pulse">
                <Shield size={64} className="text-blue-400" />
              </div>
              
              <h1 className="text-6xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 drop-shadow-2xl">
                STEALTH IN THE SHADOWS
              </h1>
              <p className="text-gray-400 text-lg mb-12 max-w-lg">
                Navigate the facility. Avoid the light. Trust the shadows.
              </p>

              <div className="flex flex-col gap-4 w-64">
                {saveData && (
                    <button 
                    onClick={() => handleStartGame(saveData.mode === 'COOP' ? 'GAME_COOP' : 'GAME_SINGLE', true)}
                    className="group relative flex items-center justify-center gap-3 px-6 py-4 bg-purple-900/50 hover:bg-purple-800 border border-purple-500/50 hover:border-purple-400 transition-all duration-300 rounded-lg mb-2"
                    >
                    <Play size={20} className="text-purple-300 group-hover:text-white" />
                    <div className="flex flex-col items-start">
                        <span className="font-bold tracking-wider text-sm">CONTINUE</span>
                        <span className="text-xs text-purple-300">Level {saveData.levelNum} - {saveData.mode}</span>
                    </div>
                    </button>
                )}

                <button 
                  onClick={() => handleStartGame('GAME_SINGLE', false)}
                  className="group relative flex items-center justify-center gap-3 px-6 py-4 bg-gray-800 hover:bg-blue-600 border border-gray-700 hover:border-blue-400 transition-all duration-300 rounded-lg"
                >
                  <User size={20} className="text-gray-400 group-hover:text-white" />
                  <span className="font-bold tracking-wider">NEW GAME</span>
                </button>

                <button 
                  onClick={() => handleStartGame('GAME_COOP', false)}
                  className="group relative flex items-center justify-center gap-3 px-6 py-4 bg-gray-800 hover:bg-emerald-600 border border-gray-700 hover:border-emerald-400 transition-all duration-300 rounded-lg"
                >
                  <Users size={20} className="text-gray-400 group-hover:text-white" />
                  <span className="font-bold tracking-wider">LOCAL CO-OP</span>
                </button>
                
                <button 
                  onClick={() => setAppMode('LEVEL_SELECT')}
                  className="group relative flex items-center justify-center gap-3 px-6 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 transition-all duration-300 rounded-lg"
                >
                  <Grid size={20} className="text-gray-600 group-hover:text-white" />
                  <span className="font-bold tracking-wider text-gray-500 group-hover:text-white">LEVEL SELECT</span>
                </button>
              </div>
            </div>

            <div className="absolute bottom-8 text-gray-600 text-sm">
               v1.2.0 &bull; Safe Spawn &bull; Level Selector &bull; Cheats
            </div>
          </div>
        );
      }

      return (
        <GameEngine 
          mode={appMode === 'GAME_SINGLE' ? 'SINGLE' : 'COOP'} 
          initialData={saveData}
          onExit={() => setAppMode('MENU')} 
        />
      );
  };

  return (
    <>
      <UpdateOverlay />
      {renderContent()}
    </>
  );
};

export default App;
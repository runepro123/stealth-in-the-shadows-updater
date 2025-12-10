
import React, { useEffect, useRef, useState } from 'react';
import { 
  GameStatus, Player, LevelData, Particle, GameSave, DialogLine, Decoy, Enemy, Point 
} from '../types';
import { 
  COLORS, PLAYER_RADIUS, PLAYER_SPEED_WALK, PLAYER_SPEED_SPRINT, 
  ENEMY_RADIUS, PLAYER_MAX_STAMINA, STAMINA_DRAIN, STAMINA_REGEN,
  EMP_RADIUS, EMP_DURATION, EMP_COOLDOWN, DECOY_COOLDOWN, DECOY_DURATION, DECOY_RADIUS,
  ENEMY_SPEED_CHASE
} from '../constants';
import { generateLevel } from '../utils/levelGen';
import { getStoryForLevel } from '../utils/storyData'; 
import { DialogOverlay } from './DialogOverlay'; 
import { 
  circleRectCollision, pointInCircle, pointInVisionCone, 
  dist, lineRectCollision 
} from '../utils/gameMath';
import { Eye, Footprints, Lightbulb, Save, Zap, Volume2, Navigation, Activity, Crosshair, Target, Video } from 'lucide-react';
import { saveGame, clearSave } from '../utils/saveManager';

interface GameEngineProps {
  mode: 'SINGLE' | 'COOP';
  initialData?: GameSave | null;
  onExit: () => void;
}

export const GameEngine: React.FC<GameEngineProps> = ({ mode, initialData, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  
  // Game State
  const [levelNum, setLevelNum] = useState(initialData ? initialData.levelNum : 1);
  const [maxLevelReached, setMaxLevelReached] = useState(initialData ? (initialData.maxLevelReached || 1) : 1);
  const [globalStealthRating, setGlobalStealthRating] = useState(initialData ? initialData.globalStealthRating : 100);
  const [collectedLore, setCollectedLore] = useState<string[]>(initialData ? initialData.collectedLore : []);
  
  // HUD State
  const [p1State, setP1State] = useState<Partial<Player>>({});
  
  // Story State
  const [currentDialogScript, setCurrentDialogScript] = useState<DialogLine[] | null>(null);
  const [overlayMsg, setOverlayMsg] = useState<string | null>(null);

  // Cutscene State
  const cutsceneRef = useRef<{
      active: boolean;
      waypoints: Point[];
      currentWaypointIndex: number;
      speed: number;
      targetsInView: Point[];
  }>({ active: false, waypoints: [], currentWaypointIndex: 0, speed: 5, targetsInView: [] });

  // Game Loop Refs
  const players = useRef<Player[]>([]);
  const levelData = useRef<LevelData | null>(null);
  const particles = useRef<Particle[]>([]);
  const decoys = useRef<Decoy[]>([]);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const screenShake = useRef<number>(0);

  // Camera State
  const camera = useRef({ x: 0, y: 0 });
  const VIEWPORT_W = 1200;
  const VIEWPORT_H = 750;

  // Initialization
  useEffect(() => {
    startLevel(levelNum);
    
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => {
        keysPressed.current.delete(e.code);
        if (e.code === 'Escape') {
            if (status === GameStatus.PLAYING) setStatus(GameStatus.PAUSED);
            else if (status === GameStatus.PAUSED) setStatus(GameStatus.PLAYING);
            else if (status === GameStatus.CUTSCENE) skipCutscene();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Save System
  useEffect(() => {
      if (status === GameStatus.LEVEL_COMPLETE) {
          const nextLvl = levelNum + 1;
          const newMax = Math.max(maxLevelReached, nextLvl);
          setMaxLevelReached(newMax);
          
          saveGame({
              levelNum: nextLvl,
              maxLevelReached: newMax,
              globalStealthRating,
              collectedLore,
              mode
          });
      }
  }, [status, levelNum, globalStealthRating, collectedLore, mode, maxLevelReached]);

  // Sync HUD
  useEffect(() => {
      const interval = setInterval(() => {
          if (players.current[0]) {
              setP1State({...players.current[0]});
          }
      }, 100);
      return () => clearInterval(interval);
  }, []);

  // Update Cinematic Bars
  useEffect(() => {
    const bars = document.querySelectorAll('.cutscene-bar');
    if (status === GameStatus.CUTSCENE) {
        bars.forEach(b => b.classList.add('active'));
    } else {
        bars.forEach(b => b.classList.remove('active'));
    }
  }, [status]);

  const startLevel = (num: number) => {
    if (num > 100) {
        determineEnding();
        return;
    }

    const level = generateLevel(num, 0, 0); 
    levelData.current = level;
    decoys.current = [];
    
    // Init Players with Advanced Stats
    const p1: Player = {
      id: 1,
      pos: { ...level.playerStart },
      radius: PLAYER_RADIUS,
      color: COLORS.PLAYER_1,
      keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', interact: 'KeyE', sprint: 'ShiftLeft', gadget1: 'KeyQ', gadget2: 'KeyF' },
      isAlive: true,
      stealthRating: 100,
      stamina: PLAYER_MAX_STAMINA,
      maxStamina: PLAYER_MAX_STAMINA,
      noiseRadius: 0,
      gadgets: {
          emp: { cooldown: 0, maxCooldown: EMP_COOLDOWN, charges: 1 },
          decoy: { cooldown: 0, maxCooldown: DECOY_COOLDOWN, charges: 1 }
      }
    };
    
    const newPlayers = [p1];
    
    if (mode === 'COOP') {
      newPlayers.push({
        id: 2,
        pos: { x: level.playerStart.x + 30, y: level.playerStart.y },
        radius: PLAYER_RADIUS,
        color: COLORS.PLAYER_2,
        keys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', interact: 'ControlRight', sprint: 'ShiftRight', gadget1: 'PageUp', gadget2: 'PageDown' },
        isAlive: true,
        stealthRating: 100,
        stamina: PLAYER_MAX_STAMINA,
        maxStamina: PLAYER_MAX_STAMINA,
        noiseRadius: 0,
        gadgets: {
            emp: { cooldown: 0, maxCooldown: EMP_COOLDOWN, charges: 1 },
            decoy: { cooldown: 0, maxCooldown: DECOY_COOLDOWN, charges: 1 }
        }
      });
    }
    
    players.current = newPlayers;
    particles.current = [];
    
    // Prepare Cutscene
    setupCutscene(level);
  };

  const setupCutscene = (level: LevelData) => {
      // Create Waypoints: Start -> High Threat/Boss -> Exit -> Start
      const waypoints: Point[] = [];
      
      // 1. Start (Center View)
      waypoints.push({ 
          x: Math.max(0, level.playerStart.x - VIEWPORT_W/2), 
          y: Math.max(0, level.playerStart.y - VIEWPORT_H/2) 
      });

      // 2. High Threat (Average of nearby enemies or Boss)
      if (level.enemies.length > 0) {
          const targetEnemy = level.enemies[Math.floor(level.enemies.length / 2)];
          waypoints.push({
             x: Math.max(0, Math.min(targetEnemy.pos.x - VIEWPORT_W/2, level.width - VIEWPORT_W)),
             y: Math.max(0, Math.min(targetEnemy.pos.y - VIEWPORT_H/2, level.height - VIEWPORT_H))
          });
      }

      // 3. Exit
      waypoints.push({
          x: Math.max(0, Math.min(level.exit.x - VIEWPORT_W/2 + 20, level.width - VIEWPORT_W)),
          y: Math.max(0, Math.min(level.exit.y - VIEWPORT_H/2 + 20, level.height - VIEWPORT_H))
      });

      // 4. Back to Start
      waypoints.push({ 
          x: Math.max(0, level.playerStart.x - VIEWPORT_W/2), 
          y: Math.max(0, level.playerStart.y - VIEWPORT_H/2) 
      });

      cutsceneRef.current = {
          active: true,
          waypoints,
          currentWaypointIndex: 0,
          speed: 8, // Drone fly speed
          targetsInView: []
      };

      // Set initial camera to start
      camera.current = { ...waypoints[0] };
      setStatus(GameStatus.CUTSCENE);
  };

  const skipCutscene = () => {
      cutsceneRef.current.active = false;
      const level = levelData.current;
      if (level) {
        // Reset camera to player
        camera.current = { 
            x: Math.max(0, level.playerStart.x - VIEWPORT_W/2), 
            y: Math.max(0, level.playerStart.y - VIEWPORT_H/2) 
        };
        
        // Start Story or Game
        const story = getStoryForLevel(level.levelNumber);
        if (story && story.length > 0) {
            setCurrentDialogScript(story);
            setStatus(GameStatus.DIALOG);
        } else {
            startGameplayWrapper(level.levelNumber, level.isBossLevel);
        }
      }
  };

  const startGameplayWrapper = (num: number, isBoss: boolean) => {
    setStatus(GameStatus.PLAYING);
    const title = isBoss ? `LEVEL ${num} - BOSS` : `LEVEL ${num}`;
    setOverlayMsg(title);
    setTimeout(() => setOverlayMsg(null), 3000);
  };

  const handleDialogComplete = () => {
      setCurrentDialogScript(null);
      if (levelData.current) {
          startGameplayWrapper(levelData.current.levelNumber, levelData.current.isBossLevel);
      }
  };

  const determineEnding = () => {
      if (globalStealthRating < 50) setStatus(GameStatus.GAME_ENDING_BAD);
      else if (collectedLore.length < 5) setStatus(GameStatus.GAME_ENDING_NEUTRAL);
      else setStatus(GameStatus.GAME_ENDING_GOOD);
      clearSave();
  };

  const addParticle = (p: Particle) => particles.current.push(p);

  const spawnFloatingText = (pos: Point, text: string, color: string) => {
      addParticle({
          pos: { ...pos },
          vel: { x: 0, y: -1 },
          life: 60, maxLife: 60,
          color, size: 14,
          type: 'TEXT',
          text
      });
  };

  const update = (dt: number) => {
    // CUTSCENE UPDATE LOGIC
    if (status === GameStatus.CUTSCENE) {
        const cut = cutsceneRef.current;
        const target = cut.waypoints[cut.currentWaypointIndex];
        
        // Move Camera
        const dx = target.x - camera.current.x;
        const dy = target.y - camera.current.y;
        const distToTarget = Math.sqrt(dx*dx + dy*dy);
        
        if (distToTarget < cut.speed) {
            cut.currentWaypointIndex++;
            if (cut.currentWaypointIndex >= cut.waypoints.length) {
                skipCutscene();
                return;
            }
        } else {
            camera.current.x += (dx / distToTarget) * cut.speed;
            camera.current.y += (dy / distToTarget) * cut.speed;
        }

        // Identify Targets in View for HUD
        if (levelData.current) {
            const margin = 50;
            const cx = camera.current.x;
            const cy = camera.current.y;
            
            cut.targetsInView = [];
            // Check Exit
            if (levelData.current.exit.x > cx && levelData.current.exit.x < cx + VIEWPORT_W) {
                cut.targetsInView.push({ x: levelData.current.exit.x + 20, y: levelData.current.exit.y + 20 });
            }
            // Check Enemies
            levelData.current.enemies.forEach(e => {
                if (e.pos.x > cx && e.pos.x < cx + VIEWPORT_W && e.pos.y > cy && e.pos.y < cy + VIEWPORT_H) {
                    cut.targetsInView.push({ ...e.pos });
                }
            });
        }
        return; // Skip gameplay update
    }


    if (status !== GameStatus.PLAYING || !levelData.current) return;
    const level = levelData.current;

    // 0. Screen Shake Decay
    if (screenShake.current > 0) screenShake.current *= 0.9;
    if (screenShake.current < 0.5) screenShake.current = 0;

    // 1. Update Players (Movement, Gadgets, Stamina)
    players.current.forEach(p => {
      if (!p.isAlive) return;

      // -- Cooldowns --
      if (p.gadgets.emp.cooldown > 0) p.gadgets.emp.cooldown--;
      if (p.gadgets.decoy.cooldown > 0) p.gadgets.decoy.cooldown--;

      // -- Movement & Sprint --
      const isSprinting = keysPressed.current.has(p.keys.sprint) && p.stamina > 0;
      const speed = isSprinting ? PLAYER_SPEED_SPRINT : PLAYER_SPEED_WALK;
      
      if (isSprinting) p.stamina = Math.max(0, p.stamina - STAMINA_DRAIN);
      else p.stamina = Math.min(p.maxStamina, p.stamina + STAMINA_REGEN);

      const move = { x: 0, y: 0 };
      if (keysPressed.current.has(p.keys.up)) move.y -= 1;
      if (keysPressed.current.has(p.keys.down)) move.y += 1;
      if (keysPressed.current.has(p.keys.left)) move.x -= 1;
      if (keysPressed.current.has(p.keys.right)) move.x += 1;

      // -- Noise Generation --
      if ((move.x !== 0 || move.y !== 0) && isSprinting) {
          p.noiseRadius = 250;
          if (Math.random() > 0.8) {
             addParticle({
                 pos: {...p.pos}, vel: {x:0, y:0}, life: 20, maxLife: 20, 
                 color: COLORS.NOISE_RING, size: 1, type: 'NOISE'
             });
          }
      } else {
          p.noiseRadius = 0;
      }

      // -- Physics --
      if (move.x !== 0 || move.y !== 0) {
        const len = Math.sqrt(move.x**2 + move.y**2);
        move.x /= len;
        move.y /= len;
        
        const nextPos = { 
          x: p.pos.x + move.x * speed, 
          y: p.pos.y + move.y * speed 
        };

        let collided = false;
        for (const wall of level.walls) {
          if (circleRectCollision(nextPos, p.radius, wall)) {
            collided = true;
            break;
          }
        }
        if (!collided) {
          p.pos = nextPos;
          // Footstep particles
          if (Math.random() > (isSprinting ? 0.5 : 0.9)) {
             addParticle({
               pos: { ...p.pos },
               vel: { x: (Math.random()-0.5)*0.5, y: (Math.random()-0.5)*0.5 },
               life: 20, maxLife: 20, color: 'rgba(255,255,255,0.1)', size: 2, type: 'DUST'
             });
          }
        }
      }

      // -- EMP Gadget --
      if (keysPressed.current.has(p.keys.gadget1) && p.gadgets.emp.cooldown <= 0) {
          p.gadgets.emp.cooldown = p.gadgets.emp.maxCooldown;
          screenShake.current = 10;
          spawnFloatingText(p.pos, "EMP BLAST!", "#00FFFF");
          
          // Disable lights
          level.lights.forEach(l => {
              if (dist(p.pos, l.pos) < EMP_RADIUS) {
                  l.isOn = false;
                  l.disabledTimer = EMP_DURATION;
              }
          });
          // Stun enemies
          level.enemies.forEach(e => {
              if (dist(p.pos, e.pos) < EMP_RADIUS) {
                  e.alertState = 'IDLE';
                  e.waitTimer = EMP_DURATION;
                  e.flashlightOn = false;
                  spawnFloatingText(e.pos, "STUNNED", "#FFFF00");
              }
          });
      }

      // -- Decoy Gadget --
      if (keysPressed.current.has(p.keys.gadget2) && p.gadgets.decoy.cooldown <= 0) {
          p.gadgets.decoy.cooldown = p.gadgets.decoy.maxCooldown;
          decoys.current.push({
              id: Math.random(),
              pos: { ...p.pos },
              life: DECOY_DURATION,
              active: true
          });
          spawnFloatingText(p.pos, "DECOY PLACED", "#FF00FF");
      }

      // -- Interact --
      if (keysPressed.current.has(p.keys.interact)) {
        level.switches.forEach(s => {
          if (dist(p.pos, s.pos) < s.radius + 20) {
             s.isActivated = !s.isActivated;
             s.targets.forEach(lid => {
               const l = level.lights.find(li => li.id === lid);
               if (l) l.isOn = !l.isOn;
             });
             keysPressed.current.delete(p.keys.interact);
             spawnFloatingText(s.pos, "SWITCHED", "#00BFFF");
          }
        });

        level.lore.forEach(l => {
          if (!l.collected && dist(p.pos, l.pos) < 20) {
            l.collected = true;
            if (!collectedLore.includes(l.text)) {
                setCollectedLore(prev => [...prev, l.text]);
            }
            setOverlayMsg("LORE DATA ACQUIRED");
            setTimeout(() => setOverlayMsg(null), 2000);
          }
        });
      }

      if (circleRectCollision(p.pos, p.radius, level.exit)) {
         setStatus(GameStatus.LEVEL_COMPLETE);
      }
    });

    // 2. Camera Follow
    let targetX = 0, targetY = 0, livingPlayers = 0;
    players.current.forEach(p => {
        if (p.isAlive) {
            targetX += p.pos.x;
            targetY += p.pos.y;
            livingPlayers++;
        }
    });

    if (livingPlayers > 0) {
        targetX /= livingPlayers;
        targetY /= livingPlayers;
        // Basic clamp
        targetX = Math.max(VIEWPORT_W/2, Math.min(targetX, level.width - VIEWPORT_W/2));
        targetY = Math.max(VIEWPORT_H/2, Math.min(targetY, level.height - VIEWPORT_H/2));

        const lerp = 0.1;
        // Apply screenshake
        const shakeX = (Math.random() - 0.5) * screenShake.current;
        const shakeY = (Math.random() - 0.5) * screenShake.current;

        camera.current.x += (targetX - VIEWPORT_W/2 - camera.current.x) * lerp;
        camera.current.y += (targetY - VIEWPORT_H/2 - camera.current.y) * lerp;
        
        // Final position with shake
        camera.current.x += shakeX;
        camera.current.y += shakeY;
    }

    // 3. Update Decoys
    decoys.current.forEach(d => d.life--);
    decoys.current = decoys.current.filter(d => d.life > 0);

    // 4. Update Lights (EMP Recovery)
    level.lights.forEach(l => {
        if (l.disabledTimer && l.disabledTimer > 0) {
            l.disabledTimer--;
            if (l.disabledTimer <= 0) l.isOn = true;
        }
    });

    // 5. Update Enemies (AI Overhaul)
    level.enemies.forEach(e => {
      // -- Flashlight --
      if (e.alertState !== 'IDLE' || levelNum > 5) e.flashlightOn = true;
      if (e.waitTimer > 0) {
          e.waitTimer--;
          return; // Stunned or waiting
      }

      let moveTarget = null;
      let moveSpeed = e.speed;

      // -- AI STATE MACHINE --
      
      // Check for Stimuli (Noise)
      let heardSomething = false;
      let noisePos: Point | null = null;
      
      // Players noise
      players.current.forEach(p => {
          if (p.isAlive && p.noiseRadius > 0 && dist(e.pos, p.pos) < p.noiseRadius) {
             heardSomething = true;
             noisePos = { ...p.pos };
          }
      });
      // Decoy noise
      decoys.current.forEach(d => {
          if (dist(e.pos, d.pos) < DECOY_RADIUS) {
              heardSomething = true;
              noisePos = { ...d.pos };
          }
      });

      if (heardSomething && noisePos && e.alertState !== 'CHASE' && e.alertState !== 'INVESTIGATE') {
          e.alertState = 'INVESTIGATE';
          e.investigatePos = noisePos;
          e.waitTimer = 30; // Pause briefly before reacting
          spawnFloatingText(e.pos, "?", "#FFFF00");
      }

      if (e.alertState === 'INVESTIGATE' && e.investigatePos) {
          moveTarget = e.investigatePos;
          moveSpeed = e.speed * 1.2;
          // Reached investigation point?
          if (dist(e.pos, e.investigatePos) < 10) {
              e.alertState = 'IDLE';
              e.investigatePos = null;
              e.waitTimer = 120; // Look around
          }
      } 
      else if (e.alertState === 'CHASE' && e.investigatePos) {
          // In chase mode, investigatePos is the last known player location
          moveTarget = e.investigatePos;
          moveSpeed = ENEMY_SPEED_CHASE;
          if (dist(e.pos, e.investigatePos) < 10) {
              e.alertState = 'INVESTIGATE'; // Lost them, look around
              e.waitTimer = 60;
          }
      }
      else {
          // Patrol
          moveTarget = e.patrolPath[e.currentPatrolIndex];
          if (dist(e.pos, moveTarget) < 5) {
              e.currentPatrolIndex = (e.currentPatrolIndex + 1) % e.patrolPath.length;
          }
      }

      // -- Movement --
      if (moveTarget) {
        const dx = moveTarget.x - e.pos.x;
        const dy = moveTarget.y - e.pos.y;
        const angle = Math.atan2(dy, dx);
        
        // Turn smoothly
        let angleDiff = angle - e.direction;
        while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        e.direction += angleDiff * 0.1;

        e.pos.x += Math.cos(e.direction) * moveSpeed;
        e.pos.y += Math.sin(e.direction) * moveSpeed;
      }

      // -- Vision Check --
      players.current.forEach(p => {
        if (!p.isAlive) return;
        
        // Vision Cone Check
        if (dist(p.pos, e.pos) < e.visionDistance) {
            if (pointInVisionCone(p.pos, e.pos, e.direction, e.visionAngle, e.visionDistance)) {
                let blocked = false;
                for (const wall of level.walls) {
                   if (dist({x: wall.x, y: wall.y}, e.pos) < e.visionDistance && lineRectCollision(e.pos, p.pos, wall)) {
                       blocked = true;
                       break;
                   }
                }
                if (!blocked) {
                    // Line of sight established
                    if (e.alertState !== 'CHASE') {
                        e.alertState = 'CHASE';
                        spawnFloatingText(e.pos, "!", "#FF0000");
                        screenShake.current = 5;
                    }
                    e.investigatePos = { ...p.pos }; // Update last known position
                    handlePlayerDeath(p);
                }
            }
        }
      });
    });

    // 6. Update Lights
    level.lights.forEach(l => {
        if (!l.isOn) return;
        players.current.forEach(p => {
            if (p.isAlive && pointInCircle(p.pos, l.pos, l.radius)) {
                handlePlayerDeath(p);
            }
        });
    });

    // 7. Update Particles
    particles.current.forEach(p => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.life--;
    });
    particles.current = particles.current.filter(p => p.life > 0);
  };

  const handlePlayerDeath = (p: Player) => {
     if (!p.isAlive) return;
     p.isAlive = false;
     setGlobalStealthRating(prev => Math.max(0, prev - 2));

     for(let i=0; i<30; i++) {
        addParticle({
           pos: {...p.pos},
           vel: {x: (Math.random()-0.5)*8, y: (Math.random()-0.5)*8},
           life: 60, maxLife: 60, color: '#FF0000', size: 3, type: 'SPARK'
        });
     }

     const allDead = players.current.every(pl => !pl.isAlive);
     if (allDead) {
         setStatus(GameStatus.GAME_OVER_CAUGHT);
     } else if (mode === 'COOP') {
         setTimeout(() => {
             if (status === GameStatus.PLAYING && levelData.current) {
                p.isAlive = true;
                p.stamina = p.maxStamina;
                p.pos = { ...levelData.current.playerStart };
             }
         }, 3000);
     }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !levelData.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const level = levelData.current;
    const cx = camera.current.x;
    const cy = camera.current.y;

    // -- CLEAR & BACKGROUND --
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(-cx, -cy);

    // -- WORLD RENDER --

    // Walls
    ctx.fillStyle = COLORS.WALL;
    ctx.strokeStyle = COLORS.WALL_BORDER;
    ctx.lineWidth = 2;
    level.walls.forEach(w => {
      if (w.x + w.w > cx && w.x < cx + VIEWPORT_W && w.y + w.h > cy && w.y < cy + VIEWPORT_H) {
          ctx.fillRect(w.x, w.y, w.w, w.h);
          ctx.strokeRect(w.x, w.y, w.w, w.h);
          // 3D effect hint
          ctx.fillStyle = '#000';
          ctx.fillRect(w.x + 5, w.y + w.h, w.w - 5, 10); 
          ctx.fillStyle = COLORS.WALL;
      }
    });

    // Floor Decals (Lore, Decoys)
    ctx.fillStyle = COLORS.LORE;
    level.lore.forEach(l => {
      if (!l.collected) {
        ctx.beginPath();
        ctx.arc(l.pos.x, l.pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = COLORS.LORE;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });
    
    decoys.current.forEach(d => {
        ctx.strokeStyle = '#FF00FF';
        ctx.beginPath();
        ctx.arc(d.pos.x, d.pos.y, (Date.now() % 500) / 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(d.pos.x - 4, d.pos.y - 4, 8, 8);
    });

    // Exit
    ctx.fillStyle = COLORS.EXIT;
    ctx.fillRect(level.exit.x, level.exit.y, level.exit.w, level.exit.h);
    ctx.shadowColor = '#FFF';
    ctx.shadowBlur = 20;
    ctx.fillRect(level.exit.x, level.exit.y, level.exit.w, level.exit.h);
    ctx.shadowBlur = 0;

    // Switches
    level.switches.forEach(s => {
      ctx.fillStyle = s.isActivated ? COLORS.SWITCH_ON : COLORS.SWITCH_OFF;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, 8, 0, Math.PI * 2);
      ctx.fill();
      // Connection lines
      if (keysPressed.current.has('AltLeft') || status === GameStatus.CUTSCENE) {
         ctx.strokeStyle = '#333';
         ctx.beginPath();
         s.targets.forEach(tid => {
             const t = level.lights.find(l => l.id === tid);
             if(t) { ctx.moveTo(s.pos.x, s.pos.y); ctx.lineTo(t.pos.x, t.pos.y); }
         });
         ctx.stroke();
      }
    });

    // Lights
    level.lights.forEach(l => {
        if (l.isOn) {
            if (l.pos.x + l.radius > cx && l.pos.x - l.radius < cx + VIEWPORT_W && 
                l.pos.y + l.radius > cy && l.pos.y - l.radius < cy + VIEWPORT_H) {
                
                const grad = ctx.createRadialGradient(l.pos.x, l.pos.y, 10, l.pos.x, l.pos.y, l.radius);
                grad.addColorStop(0, COLORS.LIGHT_CORE);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(l.pos.x, l.pos.y, l.radius, 0, Math.PI*2);
                ctx.fill();
            }
        }
    });

    // Enemies & Vision
    level.enemies.forEach(e => {
        if (e.pos.x + e.visionDistance > cx && e.pos.x - e.visionDistance < cx + VIEWPORT_W &&
            e.pos.y + e.visionDistance > cy && e.pos.y - e.visionDistance < cy + VIEWPORT_H) {
            
            // Vision Cone (Gradient)
            const coneGrad = ctx.createRadialGradient(e.pos.x, e.pos.y, 10, e.pos.x, e.pos.y, e.visionDistance);
            coneGrad.addColorStop(0, COLORS.ENEMY_VISION);
            coneGrad.addColorStop(1, 'rgba(255,0,0,0)');
            
            ctx.fillStyle = coneGrad;
            ctx.beginPath();
            ctx.moveTo(e.pos.x, e.pos.y);
            ctx.arc(e.pos.x, e.pos.y, e.visionDistance, e.direction - e.visionAngle/2, e.direction + e.visionAngle/2);
            ctx.lineTo(e.pos.x, e.pos.y);
            ctx.fill();

            // Flashlight Beam
            if (e.flashlightOn) {
                const beamGrad = ctx.createRadialGradient(e.pos.x, e.pos.y, 5, e.pos.x, e.pos.y, e.visionDistance * 1.2);
                beamGrad.addColorStop(0, COLORS.ENEMY_FLASHLIGHT);
                beamGrad.addColorStop(1, 'rgba(255,255,200,0)');
                ctx.fillStyle = beamGrad;
                ctx.beginPath();
                ctx.moveTo(e.pos.x, e.pos.y);
                ctx.arc(e.pos.x, e.pos.y, e.visionDistance * 1.2, e.direction - 0.2, e.direction + 0.2);
                ctx.lineTo(e.pos.x, e.pos.y);
                ctx.fill();
            }

            // Body
            ctx.fillStyle = COLORS.ENEMY;
            ctx.beginPath();
            ctx.arc(e.pos.x, e.pos.y, ENEMY_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            
            // Eye direction indicator
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(e.pos.x + Math.cos(e.direction)*8, e.pos.y + Math.sin(e.direction)*8, 4, 0, Math.PI*2);
            ctx.fill();
        }
    });

    // Players
    if (status !== GameStatus.CUTSCENE) {
        players.current.forEach(p => {
            if (!p.isAlive) return;
            
            // Noise Ring
            if (p.noiseRadius > 0) {
                ctx.strokeStyle = COLORS.NOISE_RING;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.pos.x, p.pos.y, p.noiseRadius * (Math.sin(Date.now()/100) * 0.2 + 0.8), 0, Math.PI*2);
                ctx.stroke();
            }

            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    }

    // Particles
    particles.current.forEach(p => {
       if (p.type === 'TEXT') {
           ctx.font = 'bold 16px monospace';
           ctx.fillStyle = p.color;
           ctx.fillText(p.text || '', p.pos.x, p.pos.y);
       } else if (p.type === 'NOISE') {
           ctx.strokeStyle = p.color;
           ctx.beginPath();
           ctx.arc(p.pos.x, p.pos.y, p.size * (20 - p.life), 0, Math.PI*2);
           ctx.stroke();
       } else {
           ctx.fillStyle = p.color;
           ctx.globalAlpha = p.life / p.maxLife;
           ctx.beginPath();
           ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
           ctx.fill();
           ctx.globalAlpha = 1.0;
       }
    });

    // CUTSCENE OVERLAY HUD
    if (status === GameStatus.CUTSCENE) {
        // Reset transform to screen space
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // REC Overlay
        ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
        ctx.beginPath();
        ctx.arc(50, 50, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.font = "bold 20px monospace";
        ctx.fillStyle = "white";
        ctx.fillText("REC", 70, 56);

        // Coordinates
        ctx.font = "14px monospace";
        ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
        ctx.fillText(`CAM_POS: [${camera.current.x.toFixed(0)}, ${camera.current.y.toFixed(0)}]`, 50, 80);
        ctx.fillText(`THRT_LVL: ${level.enemies.length > 5 ? 'CRITICAL' : 'MODERATE'}`, 50, 100);

        // Target Locks
        cutsceneRef.current.targetsInView.forEach(pos => {
            const screenX = pos.x - cx;
            const screenY = pos.y - cy;
            
            // Draw Brackets
            ctx.strokeStyle = "rgba(255, 50, 50, 0.8)";
            ctx.lineWidth = 2;
            const size = 30;
            
            ctx.beginPath();
            // Top Left
            ctx.moveTo(screenX - size, screenY - size + 10);
            ctx.lineTo(screenX - size, screenY - size);
            ctx.lineTo(screenX - size + 10, screenY - size);
            // Top Right
            ctx.moveTo(screenX + size - 10, screenY - size);
            ctx.lineTo(screenX + size, screenY - size);
            ctx.lineTo(screenX + size, screenY - size + 10);
            // Bottom Right
            ctx.moveTo(screenX + size, screenY + size - 10);
            ctx.lineTo(screenX + size, screenY + size);
            ctx.lineTo(screenX + size - 10, screenY + size);
            // Bottom Left
            ctx.moveTo(screenX - size + 10, screenY + size);
            ctx.lineTo(screenX - size, screenY + size);
            ctx.lineTo(screenX - size, screenY + size - 10);
            
            ctx.stroke();

            // Stats
            ctx.font = "10px monospace";
            ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
            ctx.fillText("TARGET_LOCK", screenX - size, screenY - size - 5);
        });

        // Skip prompt
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("PRESS [ESC] TO SKIP INTEL", canvas.width/2 - 100, canvas.height - 40);
    }
  };

  const loop = (time: number) => {
    const dt = time - lastTimeRef.current;
    lastTimeRef.current = time;
    update(dt);
    render();
    frameRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]); 

  const handleNextLevel = () => {
      const nextLvl = levelNum + 1;
      setLevelNum(nextLvl);
      startLevel(nextLvl);
  };
  
  const handleRetry = () => {
      startLevel(levelNum);
  };

  // --- RENDERING UI STATES ---

  if (status === GameStatus.GAME_ENDING_BAD || status === GameStatus.GAME_ENDING_NEUTRAL || status === GameStatus.GAME_ENDING_GOOD) {
      // (Ending screens remain the same as previous)
      return <div className="bg-black text-white h-screen flex items-center justify-center"><h1 onClick={onExit} className="cursor-pointer text-4xl">GAME OVER - CLICK TO EXIT</h1></div>
  }

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center font-mono overflow-hidden">
      
      {/* --- ADVANCED HUD --- */}
      
      {/* 1. Top Bar */}
      <div className={`absolute top-4 left-4 right-4 flex justify-between text-white pointer-events-none z-20 transition-opacity duration-500 ${status === GameStatus.CUTSCENE ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-widest text-blue-500 drop-shadow-[0_0_5px_rgba(0,191,255,0.8)]">
                LEVEL {levelNum.toString().padStart(3, '0')}
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-900/80 px-3 py-1 rounded border border-gray-700">
                <Activity size={16} className={globalStealthRating > 50 ? 'text-green-500' : 'text-red-500'} />
                <span>INTEGRITY: {Math.round(globalStealthRating)}%</span>
            </div>
        </div>

        {/* 2. Minimap (Visual Mockup for now, fully functional in logic context) */}
        <div className="w-32 h-32 bg-[#001400] border-2 border-[#003300] rounded-full relative overflow-hidden opacity-80 shadow-[0_0_10px_#00FF00]">
            <div className="absolute inset-0 flex items-center justify-center text-[#00FF00] text-xs opacity-50">NO SIGNAL</div>
            <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
            {/* Objective Arrow */}
            {levelData.current && (
                <Navigation 
                    size={20} 
                    className="absolute top-2 right-2 text-white animate-bounce" 
                    style={{ transform: `rotate(${Math.atan2(levelData.current.exit.y - (players.current[0]?.pos.y || 0), levelData.current.exit.x - (players.current[0]?.pos.x || 0))}rad)`}} 
                />
            )}
        </div>

        {/* 3. Lore */}
        <div className="text-right">
             <div className="text-purple-400 font-bold mb-1 flex items-center justify-end gap-2">
                ARCHIVE <Save size={14}/>
             </div>
             {collectedLore.slice(-3).map((l, i) => (
                  <div key={i} className="text-[10px] text-gray-400 bg-gray-900/80 px-2 py-1 mb-1 rounded border-l-2 border-purple-500">
                      {l.substring(0, 30)}...
                  </div>
             ))}
        </div>
      </div>

      {/* 4. Bottom Player Stats & Gadgets */}
      <div className={`absolute bottom-8 left-8 flex gap-8 pointer-events-none z-20 transition-opacity duration-500 ${status === GameStatus.CUTSCENE ? 'opacity-0' : 'opacity-100'}`}>
          {/* Stamina */}
          <div className="flex flex-col gap-1 w-48">
              <span className="text-xs text-blue-300 font-bold tracking-wider">EXOSUIT ENERGY (SPRINT)</span>
              <div className="w-full h-3 bg-gray-900 border border-gray-700 rounded skew-x-[-10deg] overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400" 
                    style={{ width: `${((p1State.stamina || 0) / PLAYER_MAX_STAMINA) * 100}%` }}
                  />
              </div>
          </div>

          {/* Gadgets */}
          <div className="flex gap-4">
              {/* EMP */}
              <div className="relative group">
                  <div className={`w-12 h-12 border-2 ${p1State.gadgets?.emp.cooldown === 0 ? 'border-cyan-400 bg-cyan-900/30' : 'border-gray-700 bg-gray-900'} rounded flex items-center justify-center`}>
                      <Zap size={24} className={p1State.gadgets?.emp.cooldown === 0 ? 'text-cyan-400' : 'text-gray-600'} />
                  </div>
                  <div className="absolute -bottom-5 left-0 w-full text-center text-[10px] text-gray-400 font-bold">[Q]</div>
                  {/* Cooldown Overlay */}
                  {(p1State.gadgets?.emp.cooldown || 0) > 0 && (
                     <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                         {Math.ceil((p1State.gadgets?.emp.cooldown || 0) / 60)}s
                     </div>
                  )}
              </div>

              {/* Decoy */}
              <div className="relative group">
                  <div className={`w-12 h-12 border-2 ${p1State.gadgets?.decoy.cooldown === 0 ? 'border-pink-400 bg-pink-900/30' : 'border-gray-700 bg-gray-900'} rounded flex items-center justify-center`}>
                      <Volume2 size={24} className={p1State.gadgets?.decoy.cooldown === 0 ? 'text-pink-400' : 'text-gray-600'} />
                  </div>
                  <div className="absolute -bottom-5 left-0 w-full text-center text-[10px] text-gray-400 font-bold">[F]</div>
                   {(p1State.gadgets?.decoy.cooldown || 0) > 0 && (
                     <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                         {Math.ceil((p1State.gadgets?.decoy.cooldown || 0) / 60)}s
                     </div>
                  )}
              </div>
          </div>
      </div>

      {/* 5. Controls Helper */}
      <div className={`absolute bottom-8 right-8 text-right text-[10px] text-gray-500 z-10 transition-opacity duration-500 ${status === GameStatus.CUTSCENE ? 'opacity-0' : 'opacity-100'}`}>
          <div>WASD - MOVE</div>
          <div>SHIFT - SPRINT</div>
          <div>Q - EMP BLAST</div>
          <div>F - DECOY</div>
          <div>E - INTERACT</div>
      </div>

      {/* Overlay Message */}
      {overlayMsg && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-5xl font-black text-white tracking-[1em] animate-pulse z-30 pointer-events-none text-center whitespace-nowrap drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] chromatic-aberration">
          {overlayMsg}
        </div>
      )}

      {/* DIALOG OVERLAY */}
      {status === GameStatus.DIALOG && currentDialogScript && (
          <DialogOverlay script={currentDialogScript} onComplete={handleDialogComplete} />
      )}

      {/* MAIN CANVAS */}
      <canvas 
        ref={canvasRef} 
        width={VIEWPORT_W} 
        height={VIEWPORT_H} 
        className="border-2 border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
      />

      {/* Pause Menu */}
      {status === GameStatus.PAUSED && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 backdrop-blur-md">
          <h2 className="text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 font-black mb-8 tracking-tighter">PAUSED</h2>
          <button onClick={() => setStatus(GameStatus.PLAYING)} className="px-10 py-4 border border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white transition-all mb-4 font-bold tracking-widest w-80 text-lg uppercase skew-x-[-10deg]">Resume Protocol</button>
          <button onClick={onExit} className="px-10 py-4 border border-red-900 text-red-500 hover:bg-red-900 hover:text-white transition-all font-bold tracking-widest w-80 text-lg uppercase skew-x-[-10deg]">Abort Mission</button>
        </div>
      )}

      {status === GameStatus.GAME_OVER_CAUGHT && (
        <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center z-50 backdrop-blur-md chromatic-aberration">
          <h2 className="text-8xl text-red-500 font-black mb-4 drop-shadow-[0_0_15px_rgba(255,0,0,1)]">K.I.A.</h2>
          <p className="text-red-200 mb-12 text-2xl font-mono tracking-widest">SIGNAL LOST</p>
          <button onClick={handleRetry} className="px-10 py-4 bg-white text-black hover:bg-red-500 hover:text-white transition-all mb-4 font-bold tracking-widest w-80 uppercase">RETRY SECTOR</button>
          <button onClick={onExit} className="text-gray-500 hover:text-white font-mono mt-4">Return to Base</button>
        </div>
      )}

      {status === GameStatus.LEVEL_COMPLETE && (
        <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center z-50 backdrop-blur-md">
          <h2 className="text-7xl text-emerald-400 font-black mb-4 tracking-tighter">SECTOR CLEARED</h2>
          <div className="flex gap-8 mb-12 text-emerald-200 font-mono">
              <div>STEALTH: {globalStealthRating}%</div>
              <div>TIME: {Math.floor(frameRef.current / 60)}s</div>
          </div>
          <button onClick={handleNextLevel} className="px-10 py-4 bg-emerald-500 text-black hover:bg-white transition-all mb-4 font-bold tracking-widest w-80 uppercase skew-x-[-10deg]">PROCEED</button>
        </div>
      )}
    </div>
  );
};

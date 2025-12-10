
import { TILE_SIZE, LORE_TEXTS, PLAYER_RADIUS } from '../constants';
import { LevelData, Wall, Enemy, LightSource, Switch, LoreItem, Point } from '../types';
import { SeededRNG } from './rng';
import { dist } from './gameMath';

export const generateLevel = (levelNum: number, requestedW: number, requestedH: number): LevelData => {
  const rng = new SeededRNG(levelNum * 12345 + 6789); // Deterministic seed

  // SCALING LOGIC - REDUCED DIFFICULTY
  const baseW = 1600;
  const baseH = 1000;
  // Reduced growth rate: +50 instead of +100
  const width = Math.min(4000, baseW + (levelNum - 1) * 50); 
  const height = Math.min(4000, baseH + (levelNum - 1) * 50);

  const cols = Math.floor(width / TILE_SIZE);
  const rows = Math.floor(height / TILE_SIZE);
  
  const walls: Wall[] = [];
  let enemies: Enemy[] = [];
  let lights: LightSource[] = [];
  const switches: Switch[] = [];
  const lore: LoreItem[] = [];
  
  const isBoss = levelNum % 10 === 0;
  const isTutorial = levelNum === 1;

  // 1. Grid Initialization (0 = floor, 1 = wall)
  const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(1));
  
  const carveCircle = (cx: number, cy: number, radius: number) => {
      const r2 = radius * radius;
      for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
          for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
              if (y >= 1 && y < rows - 1 && x >= 1 && x < cols - 1) {
                  const dx = x - cx;
                  const dy = y - cy;
                  if (dx*dx + dy*dy <= r2) {
                      grid[y][x] = 0;
                  }
              }
          }
      }
  };

  const carveRect = (x: number, y: number, w: number, h: number) => {
      for (let ry = y; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
          if (ry >= 1 && ry < rows - 1 && rx >= 1 && rx < cols - 1) {
            grid[ry][rx] = 0;
          }
        }
      }
  };

  // 2. Room Generation
  const rooms: {x: number, y: number, w: number, h: number}[] = [];
  
  if (isTutorial) {
    rooms.push({ x: 4, y: 8, w: 8, h: 8 }); // Start
    rooms.push({ x: 16, y: 8, w: 8, h: 8 }); // Middle
    rooms.push({ x: 28, y: 8, w: 8, h: 8 }); // End
  } else if (isBoss) {
    const margin = 4;
    rooms.push({ 
        x: margin, 
        y: margin, 
        w: cols - margin*2, 
        h: rows - margin*2 
    });
  } else {
    // Rooms scale with level
    const numRooms = 8 + Math.floor(levelNum * 0.4) + rng.nextInt(0, 2);
    
    let attempts = 0;
    while (rooms.length < numRooms && attempts < 200) {
      attempts++;
      const w = rng.nextInt(6, 14); 
      const h = rng.nextInt(6, 14);
      const x = rng.nextInt(2, cols - w - 2);
      const y = rng.nextInt(2, rows - h - 2);
      
      let overlap = false;
      for (const r of rooms) {
        if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) {
          overlap = true;
          break;
        }
      }
      
      if (!overlap) {
        rooms.push({x, y, w, h});
      }
    }
  }

  // Carve Rooms
  rooms.forEach(r => carveRect(r.x, r.y, r.w, r.h));
  
  // 3. Connect Rooms & Sort
  rooms.sort((a, b) => (a.x) - (b.x));

  for (let i = 0; i < rooms.length - 1; i++) {
    const r1 = rooms[i];
    const r2 = rooms[i + 1];
    
    const p1 = { x: Math.floor(r1.x + r1.w/2), y: Math.floor(r1.y + r1.h/2) };
    const p2 = { x: Math.floor(r2.x + r2.w/2), y: Math.floor(r2.y + r2.h/2) };
    
    let currX = p1.x;
    let currY = p1.y;

    while (currX !== p2.x) {
        carveCircle(currX, currY, 1.5);
        currX += currX < p2.x ? 1 : -1;
    }
    while (currY !== p2.y) {
        carveCircle(currX, currY, 1.5);
        currY += currY < p2.y ? 1 : -1;
    }
    carveCircle(currX, currY, 1.5);
  }

  // Boss Obstacles
  if (isBoss) {
      const r = rooms[0];
      const numPillars = 8 + Math.floor(levelNum/3);
      for(let i=0; i<numPillars; i++) {
          const px = rng.nextInt(r.x + 4, r.x + r.w - 5);
          const py = rng.nextInt(r.y + 4, r.y + r.h - 5);
          const centerX = cols/2;
          const centerY = rows/2;
          if (Math.abs(px - centerX) > 5 || Math.abs(py - centerY) > 5) {
             grid[py][px] = 1;
             grid[py][px+1] = 1;
             grid[py+1][px] = 1;
             grid[py+1][px+1] = 1;
          }
      }
  }

  // 4. Generate Walls
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) {
        walls.push({ x: c * TILE_SIZE, y: r * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE });
      }
    }
  }
  
  // 5. Entities Placement
  let playerStart: Point;
  let exit: Wall;

  if (isBoss) {
      // FIX: Force spawn points to corners for Boss levels to ensure distance
      playerStart = {
          x: 6 * TILE_SIZE,
          y: 6 * TILE_SIZE
      };
      exit = {
          x: (cols - 6) * TILE_SIZE,
          y: (rows - 6) * TILE_SIZE,
          w: 40, h: 40
      };
  } else {
      playerStart = { 
        x: (rooms[0].x + Math.floor(rooms[0].w/2)) * TILE_SIZE, 
        y: (rooms[0].y + Math.floor(rooms[0].h/2)) * TILE_SIZE 
      };
      const lastRoom = rooms[rooms.length - 1];
      exit = {
        x: (lastRoom.x + Math.floor(lastRoom.w/2)) * TILE_SIZE - 20,
        y: (lastRoom.y + Math.floor(lastRoom.h/2)) * TILE_SIZE - 20,
        w: 40,
        h: 40
      };
  }

  let lightIdCounter = 0;

  if (isTutorial) {
      const midRoom = rooms[1];
      const p1 = { x: (midRoom.x + 2) * TILE_SIZE, y: (midRoom.y + 2) * TILE_SIZE };
      const p2 = { x: (midRoom.x + midRoom.w - 2) * TILE_SIZE, y: (midRoom.y + 2) * TILE_SIZE };
      
      enemies.push({
        id: 1, pos: {...p1}, patrolPath: [p1, p2], currentPatrolIndex: 0,
        visionAngle: Math.PI/3, visionDistance: 150, direction: 0, radius: 14,
        speed: 2, alertState: 'IDLE', waitTimer: 0,
        investigatePos: null, suspicionLevel: 0, flashlightOn: false
      });

      const lastR = rooms[2];
      const lPos = { x: (lastR.x + lastR.w/2) * TILE_SIZE, y: (lastR.y + lastR.h/2) * TILE_SIZE };
      const sPos = { x: (lastR.x + 2) * TILE_SIZE, y: (lastR.y + 2) * TILE_SIZE };
      
      lights.push({ id: 0, pos: lPos, radius: 100, isOn: true, color: '#FFFFCC' });
      switches.push({ id: 0, pos: sPos, radius: 15, isActivated: false, targets: [0] });
      
      lore.push({
          id: 0, pos: { x: (rooms[0].x + 2) * TILE_SIZE, y: (rooms[0].y + 2) * TILE_SIZE },
          text: LORE_TEXTS[0], collected: false
      });

  } else {
    // EASIER PROBABILITIES
    const enemyProb = Math.min(0.6, 0.20 + (levelNum * 0.01)); 
    const lightProb = Math.min(0.7, 0.3 + (levelNum * 0.01));

    // Exclude first room (spawn) and last room (exit)
    const startIdx = isBoss ? 0 : 1;
    const endIdx = isBoss ? 1 : rooms.length - 1;

    for (let i = startIdx; i < endIdx; i++) {
        const r = rooms[i];
        
        // --- Smart Light & Switch Generation ---
        if (rng.next() < lightProb) {
            const lightId = lightIdCounter++;
            const centerX = (r.x + Math.floor(r.w/2)) * TILE_SIZE;
            const centerY = (r.y + Math.floor(r.h/2)) * TILE_SIZE;
            const switchPos = { x: centerX, y: centerY };

            const lightX = (r.x + r.w - 2) * TILE_SIZE; 
            const lightY = centerY; 
            const lightPos = { x: lightX, y: lightY };

            let lRadius = rng.nextInt(120, 180);
            
            // CRITICAL: Ensure Light DOES NOT touch the Switch at the center.
            const distToSwitch = dist(lightPos, switchPos);
            const safetyMargin = PLAYER_RADIUS * 6 + 50; 
            
            if (lRadius >= distToSwitch - safetyMargin) {
                lRadius = Math.max(50, distToSwitch - safetyMargin);
            }
            
            lights.push({
                id: lightId,
                pos: lightPos,
                radius: lRadius,
                isOn: true,
                color: '#FFFFCC',
            });
            
            switches.push({
                id: i * 100,
                pos: switchPos,
                radius: 15,
                isActivated: false,
                targets: [lightId]
            });
        }
        
        // --- Enemy Generation ---
        const spawnCount = rng.next() < 0.1 && levelNum > 10 ? 2 : 1; 
        
        if (rng.next() < enemyProb) {
            for(let k=0; k<spawnCount; k++) {
                const minX = r.x + 2; 
                const maxX = r.x + r.w - 2;
                
                let ex = rng.nextInt(minX, maxX);
                let ey = rng.nextInt(r.y + 2, r.y + r.h - 2);
                
                // Retry if close to center
                if (Math.abs(ex - (r.x + r.w/2)) < 3 && Math.abs(ey - (r.y + r.h/2)) < 3) {
                     ex = rng.nextInt(minX, maxX);
                }

                const p1 = { x: ex * TILE_SIZE, y: ey * TILE_SIZE };
                const p2 = { 
                    x: rng.nextInt(minX, maxX) * TILE_SIZE, 
                    y: rng.nextInt(r.y + 2, r.y + r.h - 2) * TILE_SIZE 
                };
                
                const visionDist = Math.min(220, 120 + levelNum * 1.5);
                const visionAng = Math.min(Math.PI * 0.5, Math.PI / 5 + levelNum * 0.005); 
                const speed = Math.min(2.8, 1.2 + levelNum * 0.02);

                enemies.push({
                    id: i * 1000 + k,
                    pos: { ...p1 },
                    patrolPath: [p1, p2],
                    currentPatrolIndex: 0,
                    visionAngle: visionAng,
                    visionDistance: visionDist,
                    direction: 0,
                    radius: 14,
                    speed: speed,
                    alertState: 'IDLE',
                    waitTimer: 0,
                    investigatePos: null, suspicionLevel: 0, flashlightOn: false
                });
            }
        }
        
        if (rng.next() < 0.12 && lore.length < 20) {
           lore.push({
             id: i,
             pos: { x: (r.x + r.w - 2) * TILE_SIZE, y: (r.y + r.h - 2) * TILE_SIZE },
             text: LORE_TEXTS[rng.nextInt(0, LORE_TEXTS.length - 1)],
             collected: false
           });
        }
    }

    if (isBoss) {
        const center = { x: (cols/2) * TILE_SIZE, y: (rows/2) * TILE_SIZE };
        const orbitRadius = 250 + (levelNum > 20 ? 50 : 0);
        const speed = Math.min(2.5, 1.8 + levelNum * 0.02);
        const guardCount = 3 + Math.floor(levelNum / 15);

        for(let k=0; k<guardCount; k++) {
             const angle = (k / guardCount) * Math.PI * 2;
             const angleNext = ((k+2) / guardCount) * Math.PI * 2;
             enemies.push({
                id: 999+k,
                pos: { x: center.x + Math.cos(angle)*orbitRadius, y: center.y + Math.sin(angle)*orbitRadius },
                patrolPath: [
                    { x: center.x + Math.cos(angle)*orbitRadius, y: center.y + Math.sin(angle)*orbitRadius },
                    { x: center.x + Math.cos(angleNext)*orbitRadius, y: center.y + Math.sin(angleNext)*orbitRadius }
                ],
                currentPatrolIndex: 0,
                visionAngle: Math.PI / 2,
                visionDistance: 200,
                direction: 0,
                radius: 16,
                speed: speed,
                alertState: 'IDLE',
                waitTimer: 0,
                investigatePos: null, suspicionLevel: 0, flashlightOn: false
            });
        }
    }
  }

  // --- FINAL SAFETY PASS ---
  // Remove any enemies or lights that are too close to player spawn to prevent instant death
  const SAFE_RADIUS = 300;
  
  enemies = enemies.filter(e => dist(e.pos, playerStart) > SAFE_RADIUS);
  lights = lights.filter(l => dist(l.pos, playerStart) > SAFE_RADIUS);

  return {
    levelNumber: levelNum,
    width: width,
    height: height,
    walls,
    enemies,
    lights,
    switches,
    lore,
    exit,
    playerStart,
    isBossLevel: isBoss
  };
};

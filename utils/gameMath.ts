import { Point, Wall } from '../types';

export const dist = (p1: Point, p2: Point) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

export const circleRectCollision = (circlePos: Point, radius: number, rect: Wall): boolean => {
  const testX = Math.max(rect.x, Math.min(circlePos.x, rect.x + rect.w));
  const testY = Math.max(rect.y, Math.min(circlePos.y, rect.y + rect.h));
  const distX = circlePos.x - testX;
  const distY = circlePos.y - testY;
  const distance = Math.sqrt(distX * distX + distY * distY);
  return distance <= radius;
};

export const pointInCircle = (p: Point, cPos: Point, r: number) => {
  return dist(p, cPos) <= r;
};

// Check if point P is inside a vision cone originating at Origin, facing Direction with Angle width and specific Distance
export const pointInVisionCone = (p: Point, origin: Point, direction: number, angle: number, distance: number) => {
  const d = dist(p, origin);
  if (d > distance) return false;

  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  
  // Angle of the point relative to origin
  const pointAngle = Math.atan2(dy, dx);
  
  // Normalize angles to -PI to PI
  let angleDiff = pointAngle - direction;
  while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

  return Math.abs(angleDiff) < angle / 2;
};

export const lineRectCollision = (p1: Point, p2: Point, rect: Wall): boolean => {
    // Basic line intersection with rectangle
    // Check if line intersects any of the 4 lines of the rect
    // Simplified for performance: Raycasting usually better, but for this game,
    // we use it to check if walls block vision. 
    // This function is a placeholder for a more complex raycast if needed.
    // For now, we assume walls block vision if the center of the wall is between player and enemy 
    // (This is too simple, so we implement a segment intersection check).
    
    const lines = [
        {p1: {x: rect.x, y: rect.y}, p2: {x: rect.x + rect.w, y: rect.y}},
        {p1: {x: rect.x + rect.w, y: rect.y}, p2: {x: rect.x + rect.w, y: rect.y + rect.h}},
        {p1: {x: rect.x + rect.w, y: rect.y + rect.h}, p2: {x: rect.x, y: rect.y + rect.h}},
        {p1: {x: rect.x, y: rect.y + rect.h}, p2: {x: rect.x, y: rect.y}}
    ];

    for (let l of lines) {
        if (getLineIntersection(p1, p2, l.p1, l.p2)) return true;
    }
    return false;
};

function getLineIntersection(p0: Point, p1: Point, p2: Point, p3: Point): boolean {
    const s1_x = p1.x - p0.x;
    const s1_y = p1.y - p0.y;
    const s2_x = p3.x - p2.x;
    const s2_y = p3.y - p2.y;

    const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = (s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);

    return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
}
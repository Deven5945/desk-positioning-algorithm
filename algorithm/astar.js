import { positionKey } from './utils.js';

export function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function findPath(start, goal, classroom, blocked = new Set()) {
  const startKey = positionKey(start);
  const queue = [{ pos: start, path: [start], cost: 0 }];
  const bestCosts = new Map([[startKey, 0]]);
  const goalKey = positionKey(goal);

  while (queue.length > 0) {
    queue.sort((a, b) => (a.cost + manhattan(a.pos, goal)) - (b.cost + manhattan(b.pos, goal)));
    const current = queue.shift();
    if (positionKey(current.pos) === goalKey) {
      return current.path;
    }

    for (const neighbor of classroom.neighbors(current.pos)) {
      const key = positionKey(neighbor);
      if (key !== goalKey && blocked.has(key)) continue;
      const nextCost = current.cost + 1;
      if (bestCosts.has(key) && bestCosts.get(key) <= nextCost) continue;
      bestCosts.set(key, nextCost);
      queue.push({
        pos: neighbor,
        path: [...current.path, neighbor],
        cost: nextCost,
      });
    }
  }
  return [start];
}

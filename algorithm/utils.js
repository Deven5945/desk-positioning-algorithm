export function positionKey(position) {
  return `${position.row}:${position.col}`;
}

export function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function samePosition(a, b) {
  return a.row === b.row && a.col === b.col;
}

export function shuffleInPlace(items, random = Math.random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function hasFixedPosition(positions, goals) {
  return goals.some((goal, index) => samePosition(goal, positions[index]));
}

function hasDirectSwap(positions, goals) {
  const indexesByPosition = new Map(
    positions.map((position, index) => [positionKey(position), index])
  );

  return goals.some((goal, index) => {
    const goalIndex = indexesByPosition.get(positionKey(goal));
    return goalIndex !== undefined &&
      goalIndex !== index &&
      samePosition(goals[goalIndex], positions[index]);
  });
}

export function createGoalShuffle(positions, random = Math.random) {
  if (positions.length < 3) {
    throw new Error('At least three desks are required to create this goal layout.');
  }

  let goals;
  do {
    goals = shuffleInPlace(positions.map((position) => ({ ...position })), random);
  } while (hasFixedPosition(positions, goals) || hasDirectSwap(positions, goals));

  return goals;
}

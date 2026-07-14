import assert from 'node:assert/strict';
import test from 'node:test';

import { Classroom } from '../classroom.js';
import { findPath } from '../algorithm/astar.js';
import { resolveConflicts } from '../algorithm/scheduler.js';
import { createGoalShuffle, positionKey, samePosition } from '../algorithm/utils.js';

function position(row, col) {
  return { row, col };
}

test('goal shuffle moves every student to a unique, non-swapped target', () => {
  const classroom = new Classroom(5, 6);
  const positions = classroom.getAllPositions();
  const indexByPosition = new Map(positions.map((item, index) => [positionKey(item), index]));

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const goals = createGoalShuffle(positions);
    const targetIndexes = goals.map((goal) => indexByPosition.get(positionKey(goal)));

    assert.equal(new Set(targetIndexes).size, positions.length, 'target positions must be unique');
    for (let index = 0; index < positions.length; index += 1) {
      assert.equal(samePosition(positions[index], goals[index]), false, 'no student may keep a seat');
      assert.notEqual(targetIndexes[targetIndexes[index]], index, 'a direct swap must not be generated');
    }
  }
});

test('A* routes around a finalised desk', () => {
  const classroom = new Classroom(3, 3);
  const path = findPath(
    position(1, 0),
    position(1, 2),
    classroom,
    new Set([positionKey(position(1, 1))])
  );

  assert.equal(path.some((step) => samePosition(step, position(1, 1))), false);
  assert.equal(path.length, 5);
});

test('scheduler rejects a head-on swap but accepts a three-desk rotation', () => {
  const first = { id: 1, current: position(0, 0), goal: position(0, 1) };
  const second = { id: 2, current: position(0, 1), goal: position(0, 0) };
  const pair = [
    { student: first, next: first.goal },
    { student: second, next: second.goal },
  ];
  const pairResult = resolveConflicts(
    pair,
    new Set(pair.map(({ student }) => positionKey(student.current))),
    'simultaneous'
  );
  assert.equal(pairResult.moves.size, 0);
  assert.deepEqual([...pairResult.collisionStudentIds].sort(), [1, 2]);

  const third = { id: 3, current: position(0, 2), goal: position(0, 0) };
  const rotation = [
    { student: first, next: first.goal },
    { student: second, next: position(0, 2) },
    { student: third, next: third.goal },
  ];
  const rotationResult = resolveConflicts(
    rotation,
    new Set(rotation.map(({ student }) => positionKey(student.current))),
    'simultaneous'
  );
  assert.equal(rotationResult.moves.size, 3);
});

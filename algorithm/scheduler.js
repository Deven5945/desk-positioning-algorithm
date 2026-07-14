import { positionKey, manhattan } from './utils.js';

export function resolveConflicts(proposals, occupied, strategy) {
  const nextMoves = new Map();
  const reserved = new Set();
  const targetMap = new Map();
  const occupantMap = new Map();
  const collisionStudentIds = new Set();

  for (const proposal of proposals) {
    const nextKey = positionKey(proposal.next);
    if (!targetMap.has(nextKey)) targetMap.set(nextKey, []);
    targetMap.get(nextKey).push(proposal);
    occupantMap.set(positionKey(proposal.student.current), proposal.student.id);
  }

  const ordered = strategy === 'astarschedule'
    ? [...proposals].sort((a, b) => {
      const da = manhattan(a.student.current, a.student.goal);
      const db = manhattan(b.student.current, b.student.goal);
      return db - da || a.student.id - b.student.id;
    })
    : [...proposals].sort((a, b) => a.student.id - b.student.id);

  const orderByStudent = new Map(ordered.map((proposal, index) => [proposal.student.id, index]));
  const chosenByTarget = new Map();
  for (const [target, group] of targetMap) {
    const winner = [...group].sort(
      (a, b) => orderByStudent.get(a.student.id) - orderByStudent.get(b.student.id)
    )[0];
    chosenByTarget.set(target, winner);
    for (const proposal of group) {
      if (proposal !== winner) collisionStudentIds.add(proposal.student.id);
    }
  }

  const usableProposals = new Map(
    [...chosenByTarget.values()].map((proposal) => [proposal.student.id, proposal])
  );

  function resolveChain(startProposal) {
    const chain = [];
    const indexByStudent = new Map();
    let current = startProposal;

    while (true) {
      const studentId = current.student.id;
      if (indexByStudent.has(studentId)) {
        const cycle = chain.slice(indexByStudent.get(studentId));
        // Head-on desk swaps are unsafe. Longer rotations are allowed because
        // all involved desks vacate their cells in the same simulation step.
        if (cycle.length === 2) {
          for (const entry of cycle) collisionStudentIds.add(entry.student.id);
          return null;
        }
        return cycle.length >= 3 ? cycle : null;
      }
      indexByStudent.set(studentId, chain.length);
      chain.push(current);

      const student = current.student;
      const nextKey = positionKey(current.next);
      const currentKey = positionKey(student.current);
      if (nextKey === currentKey) return null;

      if (chosenByTarget.get(nextKey) !== current) {
        return null;
      }

      if (!occupied.has(nextKey)) {
        return chain;
      }

      if (reserved.has(nextKey)) {
        return null;
      }

      const occupantId = occupantMap.get(nextKey);
      if (!occupantId || occupantId === student.id) {
        return null;
      }

      const occupantProposal = usableProposals.get(occupantId);
      if (!occupantProposal) {
        return null;
      }

      if (positionKey(occupantProposal.next) === nextKey) {
        return null;
      }

      current = occupantProposal;
    }
  }

  if (strategy === 'number') {
    for (const proposal of ordered) {
      if (!usableProposals.has(proposal.student.id)) continue;
      const chain = resolveChain(proposal);
      if (!chain) continue;
      for (const entry of chain) {
        const key = positionKey(entry.next);
        if (key === positionKey(entry.student.current)) continue;
        if (!nextMoves.has(entry.student.id)) {
          nextMoves.set(entry.student.id, entry.next);
          reserved.add(key);
        }
      }
      return { moves: nextMoves, collisionStudentIds };
    }
    return { moves: nextMoves, collisionStudentIds };
  }

  for (const proposal of ordered) {
    if (!usableProposals.has(proposal.student.id)) continue;
    if (nextMoves.has(proposal.student.id)) continue;
    const chain = resolveChain(proposal);
    if (!chain) continue;
    for (const entry of chain) {
      const key = positionKey(entry.next);
      if (key === positionKey(entry.student.current)) continue;
      if (!nextMoves.has(entry.student.id)) {
        nextMoves.set(entry.student.id, entry.next);
        reserved.add(key);
      }
    }
  }

  return { moves: nextMoves, collisionStudentIds };
}

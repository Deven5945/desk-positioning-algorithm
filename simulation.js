import { Classroom } from './classroom.js';
import { Student } from './student.js';
import { Renderer } from './renderer.js';
import { Statistics } from './statistics.js';
import { findPath, manhattan } from './algorithm/astar.js';
import { createGoalShuffle, positionKey, samePosition } from './algorithm/utils.js';
import { resolveConflicts } from './algorithm/scheduler.js';

const STRATEGIES = ['number', 'simultaneous', 'astarschedule'];
const MAX_STEPS = 1_000;
const ANIMATION_DELAY = 18;
const SIMULTANEOUS_BATCH_SIZE = 2;

function cloneStudents(students) {
  return students.map((student) => {
    const clone = new Student(student.id, student.start);
    clone.setGoal(student.goal);
    // Each comparison must start from the same original layout. The visible
    // students may currently be at their targets after a previous animation.
    return clone;
  });
}

function createPathProposal(student, occupied, classroom, allowOccupiedGoal = false, preventReverse = false) {
  const blocked = new Set(occupied);
  blocked.delete(positionKey(student.current));
  if (allowOccupiedGoal) {
    blocked.delete(positionKey(student.goal));
  } else if (blocked.has(positionKey(student.goal))) {
    // A desk may not enter a seat until that seat is genuinely empty.
    return null;
  }

  if (preventReverse && student.previous) {
    blocked.add(positionKey(student.previous));
  }

  const path = findPath(student.current, student.goal, classroom, blocked);
  return path.length > 1
    ? { student, next: path[1], path, pathLength: path.length }
    : null;
}

function selectAstarScheduleMoves(students, occupied, classroom) {
  return students
    .filter((student) => !student.completed)
    .map((student) => createPathProposal(student, occupied, classroom, true, true))
    .filter(Boolean)
    .sort((a, b) => b.pathLength - a.pathLength || a.student.id - b.student.id);
}

function findSeedProposals(students, occupied, classroom, limit, compareStudents) {
  const reserved = new Set();
  const seeds = [];
  const ordered = [...students].sort(compareStudents);

  for (const student of ordered) {
    const next = classroom.neighbors(student.current)
      .filter((neighbor) => !occupied.has(positionKey(neighbor)))
      .filter((neighbor) => !reserved.has(positionKey(neighbor)))
      .sort((a, b) => a.row - b.row || a.col - b.col)[0];
    if (!next) continue;
    seeds.push({ student, next });
    reserved.add(positionKey(next));
    if (seeds.length === limit) break;
  }

  return seeds;
}

function selectSequentialMove(students, occupied, classroom, activeStudentId, strategy) {
  const unfinished = students.filter((student) => !student.completed);
  const studentById = new Map(unfinished.map((student) => [student.id, student]));

  if (activeStudentId != null) {
    const activeStudent = studentById.get(activeStudentId);
    const activeProposal = activeStudent && createPathProposal(activeStudent, occupied, classroom);
    if (activeProposal) return { proposal: activeProposal, activeStudentId };
  }

  const candidates = unfinished
    .filter((student) => !occupied.has(positionKey(student.goal)))
    .map((student) => createPathProposal(student, occupied, classroom))
    .filter(Boolean)
    .sort((a, b) => strategy === 'number'
      ? a.student.id - b.student.id
      : b.pathLength - a.pathLength || a.student.id - b.student.id);
  if (candidates.length > 0) {
    return { proposal: candidates[0], activeStudentId: candidates[0].student.id };
  }

  // Every remaining goal is occupied. Move one desk into a free aisle so the
  // student targeting its old seat can be scheduled on the next step.
  const seed = findSeedProposals(
    unfinished,
    occupied,
    classroom,
    1,
    strategy === 'number'
      ? (a, b) => a.id - b.id
      : (a, b) => manhattan(b.current, b.goal) - manhattan(a.current, a.goal) || a.id - b.id
  )[0];

  return seed ? { proposal: seed, activeStudentId: null } : null;
}

function selectSimultaneousMoves(students, occupied, classroom, activePaths) {
  const unfinished = students.filter((student) => !student.completed);
  const studentById = new Map(unfinished.map((student) => [student.id, student]));
  const nextActivePaths = new Map();
  const proposals = [];
  const reservedPathCells = new Set();

  for (const [studentId, path] of activePaths) {
    const student = studentById.get(studentId);
    if (!student || path.length < 2 || !samePosition(student.current, path[0])) continue;
    nextActivePaths.set(studentId, path);
    proposals.push({ student, next: path[1], path, pathLength: path.length });
    for (const position of path) reservedPathCells.add(positionKey(position));
  }

  const candidates = unfinished
    .filter((student) => !nextActivePaths.has(student.id))
    .filter((student) => !occupied.has(positionKey(student.goal)))
    .map((student) => createPathProposal(student, occupied, classroom))
    .filter(Boolean)
    .sort((a, b) => b.pathLength - a.pathLength || a.student.id - b.student.id);

  while (proposals.length < SIMULTANEOUS_BATCH_SIZE && candidates.length > 0) {
    const candidate = candidates.shift();
    const intersectsReservedPath = candidate.path.some((position) =>
      reservedPathCells.has(positionKey(position))
    );
    if (intersectsReservedPath) continue;
    nextActivePaths.set(candidate.student.id, candidate.path);
    proposals.push(candidate);
    for (const position of candidate.path) reservedPathCells.add(positionKey(position));
  }

  if (proposals.length > 0) {
    return { proposals, activePaths: nextActivePaths };
  }

  const seeds = findSeedProposals(
    unfinished,
    occupied,
    classroom,
    SIMULTANEOUS_BATCH_SIZE,
    (a, b) => manhattan(b.current, b.goal) - manhattan(a.current, a.goal) || a.id - b.id
  );
  return { proposals: seeds, activePaths: new Map() };
}

export class Simulation {
  constructor(canvas, onStep) {
    this.classroom = new Classroom(5, 6);
    this.renderer = new Renderer(canvas, this.classroom);
    this.onStep = onStep;
    this.students = [];
    this.currentMetrics = null;
    this.currentStep = 0;
    this.currentSteps = 0;
    this.comparisonResults = {};
    this.initialize();
  }

  initialize() {
    this.students = [];
    const positions = this.classroom.getAllPositions();
    for (let i = 0; i < positions.length; i += 1) {
      this.students.push(new Student(i + 1, this.classroom.toMovementPosition(positions[i])));
    }
    this.randomizeGoals();
  }

  reset() {
    this.initialize();
    this.currentMetrics = null;
    this.currentStep = 0;
    this.currentSteps = 0;
    this.comparisonResults = {};
    this.renderer.render(this.students);
  }

  randomizeGoals() {
    const shuffled = createGoalShuffle(this.classroom.getAllPositions());

    for (let i = 0; i < this.students.length; i += 1) {
      const student = this.students[i];
      student.setGoal(this.classroom.toMovementPosition(shuffled[i]));
      student.current = { ...student.start };
      student.completed = false;
      student.waitTime = 0;
      student.distance = 0;
      student.collisionCount = 0;
    }
    this.renderer.render(this.students);
  }

  async animateStrategy(strategy) {
    const results = {};
    for (const key of STRATEGIES) {
      results[key] = this.simulateStrategy(key);
    }
    this.comparisonResults = results;
    const selected = results[strategy];
    await this.runSimulation(selected.strategyName);
  }

  simulateStrategy(strategy, options = {}) {
    const students = cloneStudents(this.students);
    const timeline = [];
    let step = 0;
    let termination = 'completed';
    let activeStudentId = null;
    let activePaths = new Map();
    const capture = options.capture ? { steps: [] } : null;

    // allow reproducing a specific goal layout when provided
    if (options.goals && Array.isArray(options.goals) && options.goals.length === students.length) {
      for (let i = 0; i < students.length; i += 1) {
        students[i].setGoal({ ...options.goals[i] });
        students[i].current = { ...students[i].start };
        students[i].completed = false;
        students[i].waitTime = 0;
        students[i].distance = 0;
        students[i].collisionCount = 0;
      }
    }

    while (students.some((s) => !s.completed)) {
      step += 1;
      const occupied = new Set(students.map((s) => positionKey(s.current)));
      const proposals = [];

      if (strategy === 'number') {
        const selection = selectSequentialMove(
          students,
          occupied,
          this.classroom,
          activeStudentId,
          strategy
        );
        activeStudentId = selection?.activeStudentId ?? null;
        if (selection) proposals.push(selection.proposal);
      } else if (strategy === 'astarschedule') {
        proposals.push(...selectAstarScheduleMoves(students, occupied, this.classroom));
      } else if (strategy === 'simultaneous') {
        const selection = selectSimultaneousMoves(
          students,
          occupied,
          this.classroom,
          activePaths
        );
        activePaths = selection.activePaths;
        proposals.push(...selection.proposals);
      }
      // capture proposals and occupied before conflict resolution when requested
      if (capture) {
        capture.steps.push({
          step,
          occupied: [...occupied].map((k) => ({ key: k })),
          proposals: proposals.map((p) => ({ studentId: p.student.id, next: { ...p.next }, pathLength: p.pathLength })),
          activePaths: [...activePaths.entries()].map(([id, path]) => ({ id, path: path.map((x) => ({ ...x })) })),
        });
      }

      // Detect 2-cycle (A <-> B swap) proposals and try to break them by
      // moving one participant into a free neighbouring aisle cell. This
      // converts a head-on swap (which resolveConflicts rejects) into a
      // stepwise move so the swap can complete in subsequent steps.
      for (let i = 0; i < proposals.length; i += 1) {
        for (let j = i + 1; j < proposals.length; j += 1) {
          const a = proposals[i];
          const b = proposals[j];
          try {
            if (!a || !b || !a.next || !b.next) continue;
            if (positionKey(a.next) === positionKey(b.student.current) &&
                positionKey(b.next) === positionKey(a.student.current)) {
              const altA = this.classroom.neighbors(a.student.current).find((n) =>
                !occupied.has(positionKey(n)) && positionKey(n) !== positionKey(b.next)
              );
              if (altA) {
                a.next = altA;
                a.path = [a.student.current, altA];
                continue;
              }
              const altB = this.classroom.neighbors(b.student.current).find((n) =>
                !occupied.has(positionKey(n)) && positionKey(n) !== positionKey(a.next)
              );
              if (altB) {
                b.next = altB;
                b.path = [b.student.current, altB];
                continue;
              }
            }
          } catch (e) {
            continue;
          }
        }
      }

      const { moves: nextMoves, collisionStudentIds } = resolveConflicts(proposals, occupied, strategy);

      if (capture) {
        const last = capture.steps[capture.steps.length - 1];
        last.nextMoves = [...nextMoves.entries()].map(([id, pos]) => ({ id, pos: { ...pos } }));
        last.collisionStudentIds = [...collisionStudentIds];
      }
      const proposalByStudent = new Map(proposals.map((proposal) => [proposal.student.id, proposal]));
      let moved = false;

      for (const student of students) {
        if (student.completed) {
          continue;
        }
        const proposed = proposalByStudent.get(student.id);
        if (proposed && nextMoves.has(student.id)) {
          if (student.moveTo(nextMoves.get(student.id))) {
            moved = true;
          }
          const activePath = activePaths.get(student.id);
          if (activePath && activePath.length > 1 && samePosition(activePath[1], student.current)) {
            activePath.shift();
          } else if (activePath) {
            activePaths.delete(student.id);
          }
        } else {
          student.waitTime += 1;
          if (collisionStudentIds.has(student.id)) student.collisionCount += 1;
        }
        if (samePosition(student.current, student.goal)) {
          student.completed = true;
          if (student.id === activeStudentId) activeStudentId = null;
          activePaths.delete(student.id);
        }
      }

      timeline.push({
        step,
        students: students.map((s) => ({
          id: s.id,
          current: { ...s.current },
          goal: { ...s.goal },
          completed: s.completed,
        })),
      });

      if (students.every((student) => student.completed)) break;
      if (!moved) {
        termination = 'stalled';
        break;
      }
      if (step >= MAX_STEPS) {
        termination = 'step-limit';
        break;
      }
    }

    const metrics = Statistics.calculate(students, step, termination);
    return {
      strategyName: strategy,
      steps: step,
      metrics,
      timeline,
      capture,
    };
  }

  async runSimulation(strategyName) {
    const simulation = this.comparisonResults[strategyName];
    if (!simulation) return;
    this.currentSteps = simulation.steps;
    this.currentStep = 0;
    this.currentMetrics = simulation.metrics;

    const timeline = simulation.timeline;
    const studentMap = new Map(this.students.map((student) => [student.id, student]));
    for (const student of this.students) {
      student.current = { ...student.start };
      student.completed = false;
      student.waitTime = 0;
      student.distance = 0;
      student.collisionCount = 0;
    }
    this.renderer.render(this.students);

    for (const record of timeline) {
      this.currentStep = record.step;
      for (const entry of record.students) {
        const student = studentMap.get(entry.id);
        if (student) {
          student.current = { ...entry.current };
          student.completed = entry.completed;
        }
      }
      this.renderer.render(this.students);
      await this.delay(ANIMATION_DELAY);
      if (this.onStep) this.onStep(this.currentStep, this.currentSteps);
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import { Simulation } from './simulation.js';

const canvas = document.getElementById('classroom-canvas');
const resetButton = document.getElementById('reset-button');
const runButton = document.getElementById('run-button');
const randomButton = document.getElementById('random-button');
const strategySelect = document.getElementById('strategy-select');
const statusLabel = document.getElementById('status-label');
const stepLabel = document.getElementById('step-label');
const metricTime = document.getElementById('metric-time');
const metricCollisions = document.getElementById('metric-collisions');
const metricWait = document.getElementById('metric-wait');
const metricDistance = document.getElementById('metric-distance');
const metricCompleted = document.getElementById('metric-completed');
const metricStatus = document.getElementById('metric-status');

const compare = {
  number: document.getElementById('compare-number'),
  numberCollisions: document.getElementById('compare-number-collisions'),
  numberWait: document.getElementById('compare-number-wait'),
  numberDistance: document.getElementById('compare-number-distance'),
  numberCompleted: document.getElementById('compare-number-completed'),
  simultaneous: document.getElementById('compare-simultaneous'),
  simultaneousCollisions: document.getElementById('compare-simultaneous-collisions'),
  simultaneousWait: document.getElementById('compare-simultaneous-wait'),
  simultaneousDistance: document.getElementById('compare-simultaneous-distance'),
  simultaneousCompleted: document.getElementById('compare-simultaneous-completed'),
  astarschedule: document.getElementById('compare-astarschedule'),
  astarscheduleCollisions: document.getElementById('compare-astarschedule-collisions'),
  astarscheduleWait: document.getElementById('compare-astarschedule-wait'),
  astarscheduleDistance: document.getElementById('compare-astarschedule-distance'),
  astarscheduleCompleted: document.getElementById('compare-astarschedule-completed'),
};

const simulation = new Simulation(canvas, updateStatus);
// Expose simulation for automated testing and debugging in the page context.
window.simulation = simulation;

// Run repeated simulations without animation. Returns an array of results.
window.runRepeatTests = function runRepeatTests(iterations = 10) {
  const out = [];
  for (let i = 0; i < iterations; i += 1) {
    simulation.randomizeGoals();
    const number = simulation.simulateStrategy('number');
    const simultaneous = simulation.simulateStrategy('simultaneous');
    const astarschedule = simulation.simulateStrategy('astarschedule');
    out.push({
      iteration: i + 1,
      number: number.metrics,
      simultaneous: simultaneous.metrics,
      astarschedule: astarschedule.metrics,
    });
  }
  return out;
};

// Run many iterations and capture failing cases for a given strategy.
window.runCaptureFailures = function runCaptureFailures({ iterations = 50, strategy = 'astarschedule', thresholdDistance = 500 } = {}) {
  const failures = [];
  for (let i = 0; i < iterations; i += 1) {
    simulation.randomizeGoals();
    const goals = simulation.students.map((s) => ({ ...s.goal }));
    const result = simulation.simulateStrategy(strategy);
    const metrics = result.metrics;
    if (!metrics.isComplete || (metrics.totalDistance != null && metrics.totalDistance > thresholdDistance)) {
      const captured = simulation.simulateStrategy(strategy, { capture: true, goals });
      failures.push({ iteration: i + 1, metrics, captured });
    }
  }
  return failures;
};
simulation.reset();
updateUi('준비 완료', 0, 0);

resetButton.addEventListener('click', () => {
  simulation.reset();
  updateUi('교실을 초기화했습니다.', 0, 0);
  renderComparison({});
});

randomButton.addEventListener('click', () => {
  simulation.randomizeGoals();
  updateUi('목표를 재생성했습니다.', 0, 0);
  renderComparison({});
});

runButton.addEventListener('click', async () => {
  if (runButton.disabled) return;

  const strategy = strategySelect.value;
  setControlsDisabled(true);
  try {
    updateUi('시뮬레이션 실행 중...', 0, 0);
    await simulation.animateStrategy(strategy);
    const metrics = simulation.currentMetrics;
    updateUi(statusMessage(metrics), simulation.currentStep, simulation.currentSteps);
    renderMetrics(metrics);
    renderComparison(simulation.comparisonResults);
  } finally {
    setControlsDisabled(false);
  }
});

async function updateStatus(step, steps) {
  updateUi('애니메이션 진행 중...', step, steps);
}

function updateUi(message, step, steps) {
  statusLabel.textContent = message;
  stepLabel.textContent = `${step} / ${steps}`;
}

function renderMetrics(metrics) {
  metricTime.textContent = metrics?.totalTime ?? '-';
  metricCollisions.textContent = metrics?.collisions ?? '-';
  metricWait.textContent = metrics?.averageWait != null ? metrics.averageWait.toFixed(2) : '-';
  metricDistance.textContent = metrics?.totalDistance ?? '-';
  metricCompleted.textContent = metrics ? `${metrics.completed} / ${metrics.studentCount}` : '-';
  metricStatus.textContent = metrics ? statusMessage(metrics) : '-';
}

function statusMessage(metrics) {
  if (!metrics) return '결과 없음';
  if (metrics.termination === 'completed') return '시뮬레이션 완료';
  if (metrics.termination === 'stalled') return '이동 가능한 경로가 없어 중단됨';
  return '최대 시뮬레이션 단계에 도달함';
}

function setControlsDisabled(disabled) {
  resetButton.disabled = disabled;
  randomButton.disabled = disabled;
  runButton.disabled = disabled;
  strategySelect.disabled = disabled;
}

function renderComparison(results) {
  if (!results || !results.number) {
    for (const key of Object.values(compare)) {
      key.textContent = '-';
    }
    return;
  }

  const defaultMetrics = { totalTime: '-', collisions: '-', averageWait: 0, totalDistance: '-', completed: null, studentCount: null };
  const numberMetrics = results.number?.metrics || defaultMetrics;
  const simultaneousMetrics = results.simultaneous?.metrics || defaultMetrics;
  const astarscheduleMetrics = results.astarschedule?.metrics || defaultMetrics;

  compare.number.textContent = numberMetrics.totalTime;
  compare.numberCollisions.textContent = numberMetrics.collisions;
  compare.numberWait.textContent = numberMetrics.averageWait?.toFixed?.(2) ?? '-';
  compare.numberDistance.textContent = numberMetrics.totalDistance;
  compare.numberCompleted.textContent = completionText(numberMetrics);

  compare.simultaneous.textContent = simultaneousMetrics.totalTime;
  compare.simultaneousCollisions.textContent = simultaneousMetrics.collisions;
  compare.simultaneousWait.textContent = simultaneousMetrics.averageWait?.toFixed?.(2) ?? '-';
  compare.simultaneousDistance.textContent = simultaneousMetrics.totalDistance;
  compare.simultaneousCompleted.textContent = completionText(simultaneousMetrics);

  compare.astarschedule.textContent = astarscheduleMetrics.totalTime;
  compare.astarscheduleCollisions.textContent = astarscheduleMetrics.collisions;
  compare.astarscheduleWait.textContent = astarscheduleMetrics.averageWait?.toFixed?.(2) ?? '-';
  compare.astarscheduleDistance.textContent = astarscheduleMetrics.totalDistance;
  compare.astarscheduleCompleted.textContent = completionText(astarscheduleMetrics);
}

function completionText(metrics) {
  return Number.isInteger(metrics.completed) && Number.isInteger(metrics.studentCount)
    ? `${metrics.completed}/${metrics.studentCount}`
    : '-';
}

// ── Dashboard Charts ───────────────────────────────────────────────────────
// Chart.js wrappers. Each render function accepts an optional `compare` array
// for the second dataset (your Supabase data), shown as grouped bars.

import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm';
Chart.register(...registerables);

const dark      = window.matchMedia('(prefers-color-scheme: dark)').matches;
const textColor = dark ? '#98989d' : '#6e6e73';
const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

const BLUE   = 'rgba(10, 132, 255, 0.75)';
const PURPLE = 'rgba(191, 90, 242, 0.75)';
const GREEN  = 'rgba(52, 199, 89, 0.75)';
const ORANGE = 'rgba(255, 159, 10, 0.75)';

const legendOpts = {
  display: true,
  labels: { color: textColor, boxWidth: 10, font: { size: 11 } },
};

const baseScales = (xLabel, yLabel = 'Pairs') => ({
  x: {
    title: { display: true, text: xLabel, color: textColor, font: { size: 11 } },
    ticks: { color: textColor, font: { size: 10 } },
    grid:  { color: gridColor },
  },
  y: {
    title: { display: true, text: yLabel, color: textColor, font: { size: 11 } },
    ticks: { color: textColor, font: { size: 10 } },
    grid:  { color: gridColor },
  },
});

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: { legend: { display: false } },
};

// ── Helpers ────────────────────────────────────────────────────────────────

const _instances = {};

function mount(id, type, data, options) {
  if (_instances[id]) _instances[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  _instances[id] = new Chart(ctx, { type, data, options });
}

// Bins values into `bins` buckets over `range` (defaults to [min, max]).
function histogram(values, bins = 20, range = null) {
  const mn = range ? range[0] : Math.min(...values);
  const mx = range ? range[1] : Math.max(...values);
  const w  = (mx - mn) / bins || 1;
  const counts = new Array(bins).fill(0);
  const labels = Array.from({ length: bins }, (_, i) => (mn + i * w).toFixed(2));
  for (const v of values) {
    const b = Math.min(Math.floor((v - mn) / w), bins - 1);
    counts[b]++;
  }
  return { labels, counts };
}

function histPair(primary, compare, bins = 20) {
  const range = compare
    ? [Math.min(...primary, ...compare), Math.max(...primary, ...compare)]
    : null;
  return {
    primary: histogram(primary, bins, range),
    compare: compare ? histogram(compare, bins, range) : null,
  };
}

// ── Public render functions ────────────────────────────────────────────────

export function renderLengthBiasChart(deltas, cmpDeltas = null) {
  const { primary, compare } = histPair(deltas, cmpDeltas);
  const datasets = [
    { label: 'HH-RLHF',   data: primary.counts, backgroundColor: PURPLE, borderRadius: 3 },
    ...(compare ? [{ label: 'Your data', data: compare.counts, backgroundColor: GREEN, borderRadius: 3 }] : []),
  ];
  mount('chartLen', 'bar',
    { labels: primary.labels, datasets },
    { ...baseOpts, plugins: { legend: compare ? legendOpts : { display: false } },
      scales: baseScales('Word count delta (chosen − rejected)') }
  );
}

export function renderOverlapChart(overlaps, cmpOverlaps = null) {
  const { primary, compare } = histPair(overlaps, cmpOverlaps);
  const datasets = [
    { label: 'HH-RLHF',   data: primary.counts, backgroundColor: GREEN,  borderRadius: 3 },
    ...(compare ? [{ label: 'Your data', data: compare.counts, backgroundColor: ORANGE, borderRadius: 3 }] : []),
  ];
  mount('chartOverlap', 'bar',
    { labels: primary.labels, datasets },
    { ...baseOpts, plugins: { legend: compare ? legendOpts : { display: false } },
      scales: baseScales('Bigram Jaccard similarity') }
  );
}

export function renderSeparabilityChart(scores, cmpScores = null) {
  const { primary, compare } = histPair(scores, cmpScores);
  const datasets = [
    { label: 'HH-RLHF',   data: primary.counts, backgroundColor: BLUE,   borderRadius: 3 },
    ...(compare ? [{ label: 'Your data', data: compare.counts, backgroundColor: ORANGE, borderRadius: 3 }] : []),
  ];
  mount('chartSep', 'bar',
    { labels: primary.labels, datasets },
    { ...baseOpts, plugins: { legend: compare ? legendOpts : { display: false } },
      scales: baseScales('Cosine distance (higher = more separable)') }
  );
}

// points: [{x,y}], labels: 'hh-chosen' | 'hh-rejected' | 'your-chosen' | 'your-rejected'
export function renderScatterChart(points, labels) {
  const group = key => points.filter((_, i) => labels[i] === key);
  mount('chartScatter', 'scatter',
    {
      datasets: [
        { label: 'HH-RLHF chosen',   data: group('hh-chosen'),    backgroundColor: BLUE,   pointRadius: 2.5 },
        { label: 'HH-RLHF rejected', data: group('hh-rejected'),  backgroundColor: PURPLE, pointRadius: 2.5 },
        { label: 'Your chosen',      data: group('your-chosen'),  backgroundColor: GREEN,  pointRadius: 5, pointStyle: 'triangle' },
        { label: 'Your rejected',    data: group('your-rejected'), backgroundColor: ORANGE, pointRadius: 5, pointStyle: 'triangle' },
      ],
    },
    {
      ...baseOpts,
      plugins: { legend: legendOpts },
      scales: baseScales('PC 1', 'PC 2'),
    }
  );
}

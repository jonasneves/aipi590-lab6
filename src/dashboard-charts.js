// ── Dashboard Charts ───────────────────────────────────────────────────────
// Chart.js wrappers. Each function creates (or replaces) a chart on a canvas.

import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm';
Chart.register(...registerables);

// Adapt to light/dark mode
const dark      = window.matchMedia('(prefers-color-scheme: dark)').matches;
const textColor = dark ? '#98989d' : '#6e6e73';
const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

const BLUE   = 'rgba(10, 132, 255, 0.75)';
const PURPLE = 'rgba(191, 90, 242, 0.75)';
const GREEN  = 'rgba(52, 199, 89, 0.75)';

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

// ── Shared helpers ─────────────────────────────────────────────────────────

const _instances = {};

function mount(id, type, data, options) {
  if (_instances[id]) _instances[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  _instances[id] = new Chart(ctx, { type, data, options });
}

function histogram(values, bins = 20) {
  const mn = Math.min(...values), mx = Math.max(...values);
  const w  = (mx - mn) / bins || 1;
  const counts = new Array(bins).fill(0);
  const labels = Array.from({ length: bins }, (_, i) => (mn + i * w).toFixed(2));
  for (const v of values) {
    const b = Math.min(Math.floor((v - mn) / w), bins - 1);
    counts[b]++;
  }
  return { labels, counts };
}

// ── Public render functions ────────────────────────────────────────────────

export function renderLengthBiasChart(deltas) {
  const { labels, counts } = histogram(deltas);
  mount('chartLen', 'bar',
    { labels, datasets: [{ data: counts, backgroundColor: PURPLE, borderRadius: 3 }] },
    { ...baseOpts, scales: baseScales('Word count delta (chosen − rejected)') }
  );
}

export function renderOverlapChart(overlaps) {
  const { labels, counts } = histogram(overlaps);
  mount('chartOverlap', 'bar',
    { labels, datasets: [{ data: counts, backgroundColor: GREEN, borderRadius: 3 }] },
    { ...baseOpts, scales: baseScales('Bigram Jaccard similarity') }
  );
}

export function renderSeparabilityChart(scores) {
  const { labels, counts } = histogram(scores);
  mount('chartSep', 'bar',
    { labels, datasets: [{ data: counts, backgroundColor: BLUE, borderRadius: 3 }] },
    { ...baseOpts, scales: baseScales('Cosine distance (higher = more separable)') }
  );
}

export function renderScatterChart(points, labels) {
  const chosen   = points.filter((_, i) => labels[i] === 'chosen');
  const rejected = points.filter((_, i) => labels[i] === 'rejected');
  mount('chartScatter', 'scatter',
    {
      datasets: [
        { label: 'Chosen',   data: chosen,   backgroundColor: BLUE,   pointRadius: 2.5 },
        { label: 'Rejected', data: rejected,  backgroundColor: PURPLE, pointRadius: 2.5 },
      ],
    },
    {
      ...baseOpts,
      plugins: {
        legend: {
          display: true,
          labels: { color: textColor, boxWidth: 10, font: { size: 11 } },
        },
      },
      scales: baseScales('PC 1', 'PC 2'),
    }
  );
}

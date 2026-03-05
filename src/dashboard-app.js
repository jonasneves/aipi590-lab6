// ── Dashboard Orchestration ────────────────────────────────────────────────
// Sequential analysis pipeline:
//   1. Fetch HH-RLHF pairs from HuggingFace
//   2. Compute instant metrics (length bias, lexical overlap) → show immediately
//   3. Compute embeddings in-browser (slow) → show separability + scatter

import { loadHHRLHF }                                   from './dashboard-data.js';
import { computeLengthBias, computeLexicalOverlap,
         computeSeparability, pca2d }                   from './dashboard-metrics.js';
import { embedTexts }                                    from './dashboard-embed.js';
import { renderLengthBiasChart, renderOverlapChart,
         renderSeparabilityChart, renderScatterChart }  from './dashboard-charts.js';

document.getElementById('analyzeBtn').addEventListener('click', onAnalyze);

async function onAnalyze() {
  const n   = parseInt(document.getElementById('sampleSize').value);
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;

  try {
    // ── Phase 1: load data ─────────────────────────────────────────────────
    setProgress('<span class="spinner"></span> Fetching HH-RLHF dataset…');
    const pairs = await loadHHRLHF(n, msg =>
      setProgress(`<span class="spinner"></span> ${msg}`)
    );
    if (!pairs.length) throw new Error('No pairs loaded — check network or try again.');

    // ── Phase 2: instant metrics ───────────────────────────────────────────
    const lenBias = computeLengthBias(pairs);
    const overlap = computeLexicalOverlap(pairs);

    setText('kpiN',       pairs.length);
    setText('kpiLen',     `${(lenBias.chosenLongerPct * 100).toFixed(0)}%`);
    setText('kpiOverlap', overlap.mean.toFixed(3));
    setText('kpiSep',     '…');

    show('kpiSection');
    show('chartsSection');
    renderLengthBiasChart(lenBias.deltas);
    renderOverlapChart(overlap.overlaps);

    // ── Phase 3: embeddings ────────────────────────────────────────────────
    const texts      = pairs.flatMap(p => [p.chosen, p.rejected]);
    const embeddings = await embedTexts(texts, msg =>
      setProgress(`<span class="spinner"></span> ${msg}`)
    );

    const pairEmbeds = pairs.map((_, i) => ({
      chosen:   embeddings[i * 2],
      rejected: embeddings[i * 2 + 1],
    }));

    const sep = computeSeparability(pairEmbeds);
    setText('kpiSep', sep.median.toFixed(3));
    renderSeparabilityChart(sep.scores);

    const points = pca2d(embeddings);
    const labels = pairs.flatMap(() => ['chosen', 'rejected']);
    renderScatterChart(points, labels);

    show('embedSection');
    setProgress('Analysis complete.', 'success');

  } catch (e) {
    setProgress(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

function setProgress(html, type = 'loading') {
  const el = document.getElementById('progress');
  el.innerHTML = html;
  el.className = `status-${type}`;
  el.classList.remove('hidden');
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function show(id) {
  document.getElementById(id).classList.remove('hidden');
}

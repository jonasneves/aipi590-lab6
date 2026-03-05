// ── Dashboard Orchestration ────────────────────────────────────────────────
// Two-phase pipeline:
//   Phase 1 (Analyze): fetch HH-RLHF → instant metrics → embeddings
//   Phase 2 (Compare): load Supabase pairs → same metrics → overlay on charts

import { loadHHRLHF, loadSupabaseData }               from './dashboard-data.js';
import { computeLengthBias, computeLexicalOverlap,
         computeSeparability, pca2d }                  from './dashboard-metrics.js';
import { embedTexts }                                   from './dashboard-embed.js';
import { renderLengthBiasChart, renderOverlapChart,
         renderSeparabilityChart, renderScatterChart }  from './dashboard-charts.js';

// Stored after phase 1 so phase 2 can re-render with both datasets.
let _hhMetrics    = null; // { lenDeltas, overlaps, sepScores }
let _hhEmbeddings = null; // Float32Array[]
let _hhPairCount  = 0;

document.getElementById('analyzeBtn').addEventListener('click', onAnalyze);
document.getElementById('compareBtn').addEventListener('click', onCompare);

// ── Phase 1: HH-RLHF analysis ─────────────────────────────────────────────

async function onAnalyze() {
  const n   = parseInt(document.getElementById('sampleSize').value);
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  hide('compareSection');

  try {
    setProgress('<span class="spinner"></span> Fetching HH-RLHF dataset…');
    const pairs = await loadHHRLHF(n, msg =>
      setProgress(`<span class="spinner"></span> ${msg}`)
    );
    if (!pairs.length) throw new Error('No pairs loaded — check network or try again.');

    const lenBias = computeLengthBias(pairs);
    const overlap = computeLexicalOverlap(pairs);

    setText('kpiN',       pairs.length);
    setText('kpiLen',     `${(lenBias.chosenLongerPct * 100).toFixed(0)}%`);
    setText('kpiOverlap', overlap.mean.toFixed(3));
    setText('kpiSep',     '…');
    clearSubs();

    show('kpiSection');
    show('chartsSection');
    renderLengthBiasChart(lenBias.deltas);
    renderOverlapChart(overlap.overlaps);

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
    const labels = pairs.flatMap(() => ['hh-chosen', 'hh-rejected']);
    renderScatterChart(points, labels);

    show('embedSection');

    // Store for comparison
    _hhMetrics    = { lenDeltas: lenBias.deltas, overlaps: overlap.overlaps, sepScores: sep.scores };
    _hhEmbeddings = embeddings;
    _hhPairCount  = pairs.length;

    show('compareSection');
    setProgress('Analysis complete.', 'success');

  } catch (e) {
    setProgress(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── Phase 2: compare with your Supabase data ──────────────────────────────

async function onCompare() {
  const btn = document.getElementById('compareBtn');
  btn.disabled = true;

  try {
    setProgress('<span class="spinner"></span> Loading your data from Supabase…');
    const pairs = await loadSupabaseData();

    if (!pairs.length) {
      setProgress('No preference pairs found in your account.', 'error');
      return;
    }

    const lenBias = computeLengthBias(pairs);
    const overlap = computeLexicalOverlap(pairs);

    // Update KPI cards with secondary values
    setSub('kpiLenSub',     `yours: ${(lenBias.chosenLongerPct * 100).toFixed(0)}%`);
    setSub('kpiOverlapSub', `yours: ${overlap.mean.toFixed(3)}`);
    setSub('kpiNSub',       `yours: ${pairs.length}`);

    // Re-render histograms with grouped bars (only if enough pairs for a meaningful histogram)
    renderLengthBiasChart(_hhMetrics.lenDeltas, lenBias.deltas);
    renderOverlapChart(_hhMetrics.overlaps, overlap.overlaps);

    // Embed your data and add to scatter + separability
    setProgress('<span class="spinner"></span> Embedding your data…');
    const texts      = pairs.flatMap(p => [p.chosen, p.rejected]);
    const yourEmbeds = await embedTexts(texts, msg =>
      setProgress(`<span class="spinner"></span> ${msg}`)
    );

    const pairEmbeds = pairs.map((_, i) => ({
      chosen:   yourEmbeds[i * 2],
      rejected: yourEmbeds[i * 2 + 1],
    }));

    const sep = computeSeparability(pairEmbeds);
    setSub('kpiSepSub', `yours: ${sep.median.toFixed(3)}`);
    renderSeparabilityChart(_hhMetrics.sepScores, sep.scores);

    // Reproject all embeddings together so PCA space is shared
    const allEmbeds = [..._hhEmbeddings, ...yourEmbeds];
    const points    = pca2d(allEmbeds);
    const labels    = [
      ...Array(_hhEmbeddings.length).fill(null).map((_, i) =>
        i % 2 === 0 ? 'hh-chosen' : 'hh-rejected'
      ),
      ...pairs.flatMap(() => ['your-chosen', 'your-rejected']),
    ];
    renderScatterChart(points, labels);

    btn.textContent = 'Refresh comparison';
    setProgress('Comparison complete.', 'success');

  } catch (e) {
    setProgress(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── UI helpers ─────────────────────────────────────────────────────────────

function setProgress(html, type = 'loading') {
  const el = document.getElementById('progress');
  el.innerHTML = html;
  el.className = `status-${type}`;
  el.classList.remove('hidden');
}

function setText(id, value)  { document.getElementById(id).textContent = value; }
function show(id)            { document.getElementById(id).classList.remove('hidden'); }
function hide(id)            { document.getElementById(id).classList.add('hidden'); }

function setSub(id, text) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.remove('hidden');
}

function clearSubs() {
  ['kpiNSub', 'kpiSepSub', 'kpiLenSub', 'kpiOverlapSub'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.add('hidden');
  });
}

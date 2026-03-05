// ── Dashboard Metrics ─────────────────────────────────────────────────────
// Pure functions — no side effects, no DOM. Each takes normalized pairs:
// [{ prompt, chosen, rejected }]

// Fraction of pairs where chosen is longer than rejected, plus word-count deltas.
export function computeLengthBias(pairs) {
  const deltas = pairs.map(p => wordCount(p.chosen) - wordCount(p.rejected));
  const chosenLonger = deltas.filter(d => d > 0).length;
  return {
    chosenLongerPct: chosenLonger / pairs.length,
    meanDelta:       mean(deltas),
    deltas,
  };
}

// Bigram Jaccard similarity between chosen and rejected per pair.
// High overlap → near-duplicate → weak DPO signal.
export function computeLexicalOverlap(pairs) {
  const overlaps = pairs.map(p => jaccardBigrams(p.chosen, p.rejected));
  return { mean: mean(overlaps), overlaps };
}

// Cosine distance between chosen and rejected embeddings per pair.
// Takes pairEmbeds: [{ chosen: Float32Array, rejected: Float32Array }]
export function computeSeparability(pairEmbeds) {
  const scores = pairEmbeds.map(({ chosen, rejected }) =>
    1 - cosineSim(chosen, rejected)
  );
  return { median: median(scores), mean: mean(scores), scores };
}

// Projects a flat list of Float32Array embeddings down to 2D via power-iteration PCA.
// Returns [{ x, y }].
export function pca2d(vectors) {
  const n = vectors.length;
  const d = vectors[0].length;

  // Center
  const mu = new Float64Array(d);
  for (const v of vectors) for (let j = 0; j < d; j++) mu[j] += v[j];
  for (let j = 0; j < d; j++) mu[j] /= n;
  const X = vectors.map(v => Array.from(v, (x, j) => x - mu[j]));

  function topPC(deflate = null) {
    // Initialise with a fixed non-random vector (reproducible)
    let u = Array.from({ length: d }, (_, i) => Math.sin(i + 1));
    const norm0 = Math.sqrt(u.reduce((s, v) => s + v * v, 0));
    u = u.map(v => v / norm0);

    for (let iter = 0; iter < 40; iter++) {
      if (deflate) {
        const dot = u.reduce((s, v, i) => s + v * deflate[i], 0);
        u = u.map((v, i) => v - dot * deflate[i]);
      }
      // u ← X^T (X u), normalised
      const Xu   = X.map(row => row.reduce((s, v, j) => s + v * u[j], 0));
      const XtXu = new Array(d).fill(0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < d; j++)
          XtXu[j] += X[i][j] * Xu[i];
      const nm = Math.sqrt(XtXu.reduce((s, v) => s + v * v, 0)) || 1;
      u = XtXu.map(v => v / nm);
    }
    return u;
  }

  const pc1 = topPC();
  const pc2 = topPC(pc1);

  return vectors.map(v => {
    const c = Array.from(v, (x, j) => x - mu[j]);
    return {
      x: c.reduce((s, x, j) => s + x * pc1[j], 0),
      y: c.reduce((s, x, j) => s + x * pc2[j], 0),
    };
  });
}

// ── Internal helpers ───────────────────────────────────────────────────────

function wordCount(str) { return str.trim().split(/\s+/).length; }

function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function jaccardBigrams(a, b) {
  const bg = str => {
    const words = str.toLowerCase().split(/\s+/);
    const s = new Set();
    for (let i = 0; i < words.length - 1; i++) s.add(`${words[i]} ${words[i + 1]}`);
    return s;
  };
  const A = bg(a), B = bg(b);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

function cosineSim(a, b) {
  let dot = 0, mA = 0, mB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    mA  += a[i] * a[i];
    mB  += b[i] * b[i];
  }
  return dot / (Math.sqrt(mA) * Math.sqrt(mB));
}

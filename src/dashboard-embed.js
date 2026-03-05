// ── Dashboard Embeddings ───────────────────────────────────────────────────
// In-browser sentence embeddings via @xenova/transformers.
// Model: Xenova/all-MiniLM-L6-v2 — 384-dim, ~23 MB, cached after first load.

let _extractor = null;

async function getExtractor(onStatus) {
  if (_extractor) return _extractor;
  onStatus?.('Loading embedding model (~23 MB, cached after first visit)…');
  const { pipeline } = await import(
    'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
  );
  _extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return _extractor;
}

// Returns Float32Array[] — one 384-dim vector per input string.
export async function embedTexts(texts, onStatus) {
  const ext = await getExtractor(onStatus);
  const BATCH = 8;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    onStatus?.(`Computing embeddings… ${i} / ${texts.length}`);
    const batch = texts.slice(i, i + BATCH);
    const out   = await ext(batch, { pooling: 'mean', normalize: true });
    for (let j = 0; j < batch.length; j++) {
      results.push(Float32Array.from(out[j].data));
    }
  }

  return results;
}

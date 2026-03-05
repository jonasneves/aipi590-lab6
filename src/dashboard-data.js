// ── Dashboard Data Loading ─────────────────────────────────────────────────
// Fetches preference pairs from the HuggingFace Datasets Server REST API.
// No auth required for public datasets; CORS-open endpoint.

const HF_API = 'https://datasets-server.huggingface.co/rows';

// HH-RLHF stores full multi-turn conversations. Extract the final assistant
// reply and the conversation history that prompted it.
function splitConversation(conv) {
  const MARKER = '\n\nAssistant: ';
  const idx = conv.lastIndexOf(MARKER);
  if (idx === -1) return { prompt: '', response: conv.trim() };
  return {
    prompt:   conv.slice(0, idx).trim(),
    response: conv.slice(idx + MARKER.length).trim(),
  };
}

// Fetches up to `n` pairs from Anthropic/hh-rlhf (test split).
// Calls onProgress(msg) while loading.
export async function loadHHRLHF(n = 100, onProgress) {
  const BATCH = 100;
  const pairs = [];

  for (let offset = 0; pairs.length < n; offset += BATCH) {
    const length = Math.min(BATCH, n - pairs.length);
    onProgress?.(`Fetching dataset… ${pairs.length} / ${n}`);

    const url =
      `${HF_API}?dataset=Anthropic%2Fhh-rlhf` +
      `&config=default&split=test&offset=${offset}&length=${length}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HuggingFace API error: HTTP ${res.status}`);
    const data = await res.json();

    for (const { row } of data.rows) {
      if (!row.chosen || !row.rejected) continue;
      const { prompt, response: chosen }   = splitConversation(row.chosen);
      const { response: rejected }          = splitConversation(row.rejected);
      if (chosen && rejected) pairs.push({ prompt, chosen, rejected });
    }

    // Stop if we've hit the end of the split
    if (data.rows.length < BATCH) break;
  }

  return pairs.slice(0, n);
}

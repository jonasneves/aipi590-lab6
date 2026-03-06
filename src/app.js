import { startLogin, logout, renderAuthState, saveOpenAIKey } from './auth.js';
import { loadFromSupabase, saveToSupabase, deleteFromSupabase } from './db.js';
import { PROMPTS, generateResponses } from './ai.js';

let currentSession = null;
let history = [];

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
  renderAuthState();

  // Restore saved OpenAI key into the input field (if any)
  const savedKey = localStorage.getItem('rlhf_api_key');
  if (savedKey) document.getElementById('apiKey').value = savedKey;

  // Populate the sample prompt dropdown
  const sel = document.getElementById('promptSelect');
  PROMPTS.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = `${i + 1}. ${p.slice(0, 72)}…`;
    sel.appendChild(opt);
  });

  document.getElementById('loginBtn').addEventListener('click', startLogin);
  document.getElementById('logoutBtn').addEventListener('click', () => { logout(); renderAuthState(); });
  document.getElementById('saveKeyBtn').addEventListener('click', onSaveKey);
  document.getElementById('promptSelect').addEventListener('change', onLoadSample);
  document.getElementById('genBtn').addEventListener('click', onGenerate);
  document.getElementById('exportBtn').addEventListener('click', onExportJSONL);
  document.getElementById('clearBtn').addEventListener('click', onClearAll);
  document.querySelectorAll('.pref-btn').forEach(btn => {
    btn.addEventListener('click', () => onPrefer(btn.dataset.pref));
  });

  // Load preference history from Supabase
  setStatus('<span class="spinner"></span> Loading history…', 'loading');
  setDbStatus('syncing', 'Connecting to Supabase…');
  try {
    history = await loadFromSupabase();
    setStatus(`Loaded ${history.length} entries.`, 'success');
    setDbStatus('connected', `Supabase · ${history.length} rows`);
  } catch (e) {
    setStatus('Could not load history: ' + e.message, 'error');
    setDbStatus('error', 'Supabase unreachable');
  }
  renderHistory();
})();

// ── UI helpers ────────────────────────────────────────────────────────────────
function setStatus(html, type) {
  const el = document.getElementById('status');
  el.innerHTML = html;
  el.className = 'status-' + type;
  el.classList.remove('hidden');
}

function setDbStatus(state, label) {
  document.getElementById('dbDot').className = 'db-dot ' + state;
  document.getElementById('dbLabel').textContent = label;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Event handlers ────────────────────────────────────────────────────────────
function onSaveKey() {
  const k = document.getElementById('apiKey').value.trim();
  saveOpenAIKey(k);
  setStatus('OpenAI key saved.', 'success');
}

function onLoadSample() {
  const v = document.getElementById('promptSelect').value;
  if (v) document.getElementById('promptInput').value = v;
}

async function onGenerate() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { setStatus('Enter a prompt first.', 'error'); return; }

  const fallbackToken = document.getElementById('apiKey').value.trim();
  const btn = document.getElementById('genBtn');
  btn.disabled = true;
  setStatus('<span class="spinner"></span> Generating two responses…', 'loading');
  document.getElementById('responsesSection').classList.add('hidden');
  currentSession = null;

  try {
    const [resA, resB] = await generateResponses(prompt, fallbackToken);
    currentSession = { prompt, resA, resB };

    document.getElementById('textA').textContent = resA.text;
    document.getElementById('metaA').textContent =
      `${resA.model} · temp ${resA.temperature} · ${resA.output_tokens} tokens · ${resA.latency_ms}ms`;

    document.getElementById('textB').textContent = resB.text;
    document.getElementById('metaB').textContent =
      `${resB.model} · temp ${resB.temperature} · ${resB.output_tokens} tokens · ${resB.latency_ms}ms`;

    document.getElementById('cardA').className = 'response-card';
    document.getElementById('cardB').className = 'response-card';
    document.getElementById('responsesSection').classList.remove('hidden');
    document.querySelectorAll('.pref-btn').forEach(b => b.disabled = false);
    setStatus('Select your preference below.', 'success');
  } catch (e) {
    setStatus('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function onPrefer(choice) {
  if (!currentSession) return;
  const { prompt, resA, resB } = currentSession;

  // Visually highlight winner / dim loser
  if (choice === 'A') {
    document.getElementById('cardA').className = 'response-card winner';
    document.getElementById('cardB').className = 'response-card loser';
  } else if (choice === 'B') {
    document.getElementById('cardA').className = 'response-card loser';
    document.getElementById('cardB').className = 'response-card winner';
  }
  document.querySelectorAll('.pref-btn').forEach(b => b.disabled = true);

  const chosen   = choice === 'A' ? resA.text : choice === 'B' ? resB.text : null;
  const rejected = choice === 'A' ? resB.text : choice === 'B' ? resA.text : null;

  const record = {
    id:        Date.now(),
    timestamp: new Date().toISOString(),
    prompt,
    response_a: resA.text,
    response_b: resB.text,
    preference: choice,
    chosen,
    rejected,
    metadata: {
      model:           resA.model,
      temp_a:          resA.temperature,
      temp_b:          resB.temperature,
      input_tokens:    resA.input_tokens,
      output_tokens_a: resA.output_tokens,
      output_tokens_b: resB.output_tokens,
      latency_a_ms:    resA.latency_ms,
      latency_b_ms:    resB.latency_ms,
    },
  };

  currentSession = null;
  setStatus('<span class="spinner"></span> Saving…', 'loading');
  setDbStatus('syncing', 'Saving to Supabase…');

  saveToSupabase(record)
    .then(() => {
      history.unshift(record);
      renderHistory();
      setStatus('Preference saved. Ready for the next prompt.', 'success');
      setDbStatus('connected', `Supabase · ${history.length} rows`);
    })
    .catch(e => {
      setStatus(`Save failed: ${e.message}`, 'error');
      setDbStatus('error', 'Supabase unreachable');
      document.querySelectorAll('.pref-btn').forEach(b => b.disabled = false);
    });
}

// ── History rendering ─────────────────────────────────────────────────────────
function renderHistory() {
  document.getElementById('countBadge').textContent = history.length;
  const list = document.getElementById('historyList');

  if (!history.length) {
    list.innerHTML = '<div class="empty-state">No preferences recorded yet.</div>';
    return;
  }

  list.innerHTML = history.map(r => {
    const label = r.preference === 'tie' ? 'Tie' : 'Preferred ' + r.preference;
    const time  = r.created_at
      ? new Date(r.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : r.timestamp?.slice(0, 16).replace('T', ' ');
    const promptText = (r.prompt || '').slice(0, 120);
    const truncated  = (r.prompt || '').length > 120 ? '…' : '';
    return `
      <div class="history-entry">
        <div class="history-prompt">${esc(promptText)}${truncated}</div>
        <div class="history-meta">
          <span class="pref-label ${r.preference}">${label}</span>
          <span class="history-time">${time}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Export ────────────────────────────────────────────────────────────────────
function onExportJSONL() {
  if (!history.length) { setStatus('No data to export yet.', 'error'); return; }

  // JSONL format: one JSON object per line, ready for fine-tuning pipelines.
  const lines = history.map(r => JSON.stringify({
    prompt:     r.prompt,
    chosen:     r.chosen,
    rejected:   r.rejected,
    preference: r.preference,
    metadata:   r.metadata,
    timestamp:  r.timestamp,
  }));

  const blob = new Blob([lines.join('\n')], { type: 'application/jsonl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rlhf_preferences_${new Date().toISOString().slice(0, 10)}.jsonl`;
  a.click();
}

// ── Clear all ─────────────────────────────────────────────────────────────────
async function onClearAll() {
  if (!confirm('Delete all preferences from Supabase? This cannot be undone.')) return;
  setStatus('<span class="spinner"></span> Deleting…', 'loading');
  setDbStatus('syncing', 'Deleting from Supabase…');
  try {
    await deleteFromSupabase();
    history = [];
    renderHistory();
    setStatus('All preferences deleted.', 'success');
    setDbStatus('connected', 'Supabase · 0 rows');
  } catch (e) {
    setStatus('Delete failed: ' + e.message, 'error');
    setDbStatus('error', 'Supabase unreachable');
  }
}

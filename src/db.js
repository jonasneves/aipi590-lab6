// The publishable key is safe to expose; row-level security on Supabase
// allows anonymous reads and inserts on this table.

const SUPABASE_URL = 'https://mkjwvkaasuhdgmgdgmvc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_py30014paACSfymw9BNoUQ_Ppysqtpx';

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Supabase HTTP ${res.status}`);
  }
  return res;
}

export async function loadFromSupabase() {
  const res = await sbFetch('preferences?select=*&order=created_at.desc', {
    headers: { 'Prefer': 'return=representation' },
  });
  return res.json();
}

export async function saveToSupabase(record) {
  await sbFetch('preferences', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      prompt:     record.prompt,
      response_a: record.response_a,
      response_b: record.response_b,
      preference: record.preference,
      chosen:     record.chosen,
      rejected:   record.rejected,
      metadata:   record.metadata,
    }),
  });
}

export async function deleteFromSupabase() {
  // PostgREST requires a filter on DELETE; id=gte.0 matches all rows (IDs are positive).
  await sbFetch('preferences?id=gte.0', { method: 'DELETE' });
}

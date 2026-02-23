// ── Layer 1: Authentication ────────────────────────────────────────────────────
// Handles GitHub OAuth 2.0 login flow and OpenAI API key storage.
// GitHub Models is the primary path; OpenAI key is the fallback.

export const GH_CLIENT_ID  = 'Ov23liv9vcDu4xC3VpWO';
export const GH_PROXY_URL  = 'https://cors-proxy.jonasneves.workers.dev';
export const GH_MODELS_URL = 'https://models.inference.ai.azure.com/chat/completions';

const GH_STORAGE    = 'lab6-auth';
const OPENAI_STORAGE = 'rlhf_api_key';

// Returns the stored GitHub auth object { token, user } or null.
export function getGHAuth() {
  try { return JSON.parse(localStorage.getItem(GH_STORAGE)); } catch { return null; }
}

// Returns the stored OpenAI API key or null.
export function getOpenAIKey() {
  return localStorage.getItem(OPENAI_STORAGE);
}

// Persists the OpenAI API key to localStorage.
export function saveOpenAIKey(key) {
  localStorage.setItem(OPENAI_STORAGE, key);
}

// Redirects to GitHub's OAuth authorization endpoint.
export function startLogin() {
  const state = crypto.randomUUID();
  sessionStorage.setItem('oauth_state', state);
  const params = new URLSearchParams({
    client_id: GH_CLIENT_ID,
    redirect_uri: window.location.origin + '/aipi590-lab6/',
    scope: 'read:user',
    state,
  });
  window.location.href = 'https://github.com/login/oauth/authorize?' + params;
}

// Called on page load when GitHub redirects back with ?code=&state=.
// Exchanges the code for an access token via our Cloudflare Workers proxy
// (needed because GitHub's token endpoint doesn't allow CORS from browsers).
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code  = params.get('code');
  const state = params.get('state');
  if (!code || !state) return;

  const storedState = sessionStorage.getItem('oauth_state');
  sessionStorage.removeItem('oauth_state');
  window.history.replaceState({}, '', window.location.pathname);

  if (state !== storedState) throw new Error('State mismatch');

  const res = await fetch(GH_PROXY_URL + '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GH_CLIENT_ID,
      code,
      redirect_uri: window.location.origin + '/aipi590-lab6/',
    }),
  });

  const data = await res.json();
  if (data.error || !data.access_token) {
    throw new Error(data.error_description || 'Login failed');
  }

  localStorage.setItem(GH_STORAGE, JSON.stringify({
    token: data.access_token,
    user: data.user,
  }));
}

// Clears the stored GitHub token, effectively logging out.
export function logout() {
  localStorage.removeItem(GH_STORAGE);
}

// Updates the auth UI to reflect current login state.
export function renderAuthState() {
  const auth = getGHAuth();
  document.getElementById('ghLoggedIn').classList.toggle('hidden', !auth);
  document.getElementById('ghLoggedOut').classList.toggle('hidden', !!auth);
  if (auth?.user) {
    document.getElementById('ghAvatar').src = auth.user.avatar_url;
    document.getElementById('ghUsername').textContent = auth.user.login;
  }
}

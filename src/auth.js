export const GH_CLIENT_ID  = 'Ov23li3dnFMUNHbu1SjZ';
export const GH_PROXY_URL  = 'https://cors-proxy.jonasneves.workers.dev';
export const GH_MODELS_URL = 'https://models.inference.ai.azure.com/chat/completions';

const GH_REDIRECT_URI = 'https://neevs.io/auth/';
const GH_STORAGE      = 'gh-auth';
const OPENAI_STORAGE  = 'rlhf_api_key';

export function getGHAuth() {
  try { return JSON.parse(localStorage.getItem(GH_STORAGE)); } catch { return null; }
}

export function getOpenAIKey() {
  return localStorage.getItem(OPENAI_STORAGE);
}

export function saveOpenAIKey(key) {
  localStorage.setItem(OPENAI_STORAGE, key);
}

export function startLogin() {
  const state = crypto.randomUUID();
  sessionStorage.setItem('oauth_state', state);
  const params = new URLSearchParams({
    client_id: GH_CLIENT_ID,
    redirect_uri: GH_REDIRECT_URI,
    scope: 'read:user',
    state,
  });

  const popup = window.open(
    'https://github.com/login/oauth/authorize?' + params,
    'gh-oauth',
    'width=600,height=700,popup=1'
  );
  if (!popup) return;

  function onMsg(e) {
    if (e.data?.type !== 'gh-auth') return;
    window.removeEventListener('message', onMsg);
    if (e.data.auth) {
      localStorage.setItem(GH_STORAGE, JSON.stringify(e.data.auth));
      renderAuthState();
    }
    try { popup.close(); } catch {}
  }
  window.addEventListener('message', onMsg);
}

export function logout() {
  localStorage.removeItem(GH_STORAGE);
}

export function renderAuthState() {
  const auth = getGHAuth();
  document.getElementById('ghLoggedIn').classList.toggle('hidden', !auth);
  document.getElementById('ghLoggedOut').classList.toggle('hidden', !!auth);
  if (auth?.login) {
    document.getElementById('ghAvatar').src = auth.avatar_url;
    document.getElementById('ghUsername').textContent = auth.login;
  }
}

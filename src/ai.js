import { getGHAuth, getOpenAIKey, GH_MODELS_URL } from './auth.js';

export const PROMPTS = [
  "My startup has a chance to raise funding from a VC with well-known ethical controversies, but we need the money to survive another six months. What should I do?",
  "I'm two years into a PhD program and rapid AI progress is making my research direction feel irrelevant. Should I drop out and join an AI startup?",
  "I found a serious bug in my friend's code right before their big client demo. Telling them will cause panic; staying quiet risks a public failure. What should I do?",
  "I have two job offers: one pays 30% more but the product feels meaningless, the other pays less but works on climate change. How should I choose?",
  "My manager consistently takes credit for my work in team meetings. I need a promotion in the next review cycle. How do I handle this without destroying the relationship?",
  "A colleague confided that they're quietly job hunting. My manager would definitely want to know. Should I tell them?",
  "I built an AI tool that performs well in testing but I'm not confident it's safe at scale. My company is pressuring me to ship it now. What do I do?",
  "A close friend wants to borrow a significant amount of money. I have it, but based on past patterns I don't think they'll repay it. Should I lend it?",
  "I witnessed a minor safety violation at work—probably harmless, but it could be serious. Reporting it might cost my colleague their job. What should I do?",
  "My professor gave me feedback I strongly disagree with. Should I push back openly or accept the grade and move on?",
  "I have access to a dataset that could significantly advance my research, but I'm not certain the data was collected with proper consent. Should I use it?",
  "My team built a classifier with 95% accuracy. A healthcare client wants to deploy it in a high-stakes medical triage setting. Should I support this?",
  "I was offered co-authorship on a paper where my contribution was small and mostly done months ago. Is it ethical to accept?",
  "A colleague asks me to write them a strong recommendation for a senior role I genuinely think they're not ready for. What do I say?",
  "I discovered that a widely-used open-source AI model produces biased outputs in a specific domain. Publishing my findings could harm the reputation of the researchers who built it. What should I do?",
  "My side project is growing fast but scaling it requires compute costs I can't personally cover. Should I monetize it, seek funding, or let it die?",
  "I received a high-paying offer to work on AI at a defense contractor. The work would be technically impressive but ethically complex. Should I take it?",
  "A user of my consumer app appears to be in a mental health crisis based on their messages. My app has no mental health features and no support infrastructure. Do I intervene?",
  "I'm close to a research breakthrough, but the direction now feels disconnected from the values that motivated me to start. Should I push through or pivot?",
  "My team wants to A/B test a product change that I believe will improve our metrics but will also subtly nudge users toward more spending. Should I raise this concern?",
  "A junior engineer on my team made an honest mistake that caused a production outage. My VP is asking directly who is responsible. What do I say?",
  "I'm considering using an AI to write my cover letter for a competitive job application. Is this dishonest, or just using available tools like everyone else?",
  "My company's AI product works well for most users but I've found it consistently underperforms for non-English speakers. Fixing it would delay the launch. What should I do?",
];

// Makes a single chat completion request and returns the response with metadata.
// `fallbackToken` is the raw OpenAI key from the input field (unsaved).
export async function callAPI(prompt, temperature, fallbackToken = null) {
  const ghAuth = getGHAuth();
  const t0 = Date.now();

  const model = 'gpt-4o-mini';
  let url, token;
  if (ghAuth) {
    url   = GH_MODELS_URL;
    token = ghAuth.token;
  } else {
    url   = 'https://api.openai.com/v1/chat/completions';
    token = getOpenAIKey() || fallbackToken;
    if (!token) throw new Error('Sign in with GitHub or enter an OpenAI API key above.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      temperature,
      messages: [
        { role: 'system', content: 'Respond in 2-3 sentences. Be direct and practical.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    text:          data.choices[0].message.content,
    model:         data.model,
    input_tokens:  data.usage.prompt_tokens,
    output_tokens: data.usage.completion_tokens,
    temperature,
    latency_ms:    Date.now() - t0,
    timestamp:     new Date().toISOString(),
  };
}

export async function generateResponses(prompt, fallbackToken = null) {
  return Promise.all([
    callAPI(prompt, 0.7, fallbackToken),
    callAPI(prompt, 1.0, fallbackToken),
  ]);
}

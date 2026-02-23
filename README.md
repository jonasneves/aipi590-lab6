# RLHF Preference Collector

A browser-based tool for collecting human preference labels over LLM outputs — the data collection step in Reinforcement Learning from Human Feedback (RLHF).

## What it does

For each prompt, two responses are generated in parallel using the same model at different temperatures (0.7 vs 1.0). The user labels which response they prefer (A / B / Tie). Each labeled pair is stored as a training record with `chosen` and `rejected` fields, ready for fine-tuning with DPO or PPO.

```
Prompt → [Response A (temp=0.7), Response B (temp=1.0)]
                          ↓
               Human preference label
                          ↓
         { prompt, chosen, rejected } → Supabase
                          ↓
              Export as .jsonl dataset
```

## Architecture

The app is a static site (no backend) split into four layers:

| File | Layer | Responsibility |
|---|---|---|
| `src/auth.js` | Auth | GitHub OAuth 2.0 login; OpenAI API key fallback |
| `src/db.js` | Database | Supabase REST API — save, load, delete preference records |
| `src/ai.js` | AI | Parallel model calls; captures latency, tokens, temperature |
| `src/app.js` | Orchestration | Wires the RLHF loop; renders history; exports JSONL |

## Key concepts

**Why two temperatures?** Sampling at temp=1.0 produces more varied, creative outputs than temp=0.7. The intentional divergence increases the chance that responses are meaningfully different, yielding higher-signal preference labels.

**Why JSONL?** One JSON object per line is the standard input format for fine-tuning pipelines (e.g. HuggingFace TRL's `DPOTrainer`). Each record includes `chosen` and `rejected` alongside full metadata.

**Why a CORS proxy?** GitHub's OAuth token endpoint does not allow browser-side requests. A lightweight Cloudflare Worker acts as the exchange intermediary, keeping the client secret out of the browser.

## Stack

- **AI:** GitHub Models (`gpt-4o-mini`) · OpenAI API fallback
- **DB:** Supabase (PostgreSQL via REST)
- **Auth:** GitHub OAuth 2.0
- **Hosting:** GitHub Pages (static, no build step)

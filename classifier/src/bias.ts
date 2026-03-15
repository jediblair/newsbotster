import axios from 'axios';

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? 'llama3.2';
const CLAUDE_KEY   = process.env.CLAUDE_API_KEY  ?? '';

export type BiasTag = 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'unknown';
export type ContentTags = string[];

const BIAS_LABELS: BiasTag[] = ['left','center-left','center','center-right','right','unknown'];

const VALID_TAGS = new Set([
  'politics','world','nz','au','us','uk','tech','business','science',
  'health','sport','climate','crime','entertainment','opinion','finance','economy',
]);

const SYSTEM_PROMPT = `You are a news article classifier.
Given an article title and summary, return a JSON object with exactly two fields:
1. "bias": political leaning - one of: left, center-left, center, center-right, right, unknown
2. "tags": array of 1-4 topic tags chosen ONLY from: politics, world, nz, au, us, uk, tech, business, science, health, sport, climate, crime, entertainment, opinion, finance, economy

Return ONLY valid JSON. No explanation, no markdown, no extra text.
Example: {"bias":"center","tags":["politics","nz"]}`;

export interface Classification {
  bias: BiasTag;
  tags: ContentTags;
}

function parseClassification(raw: string): Classification {
  // Try to extract JSON from the response
  const jsonMatch = raw.match(/\{[^}]+\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const bias = BIAS_LABELS.find(l => String(parsed.bias ?? '').toLowerCase().includes(l)) ?? 'unknown';
      const tags = Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((t: unknown) => typeof t === 'string' && VALID_TAGS.has(t.toLowerCase()))
            .map((t: string) => t.toLowerCase())
            .slice(0, 4)
        : [];
      return { bias, tags };
    } catch { /* fall through to plain-text parse */ }
  }
  // Fallback: treat as plain bias label only
  const clean = raw.toLowerCase().trim().replace(/[^a-z-]/g, '');
  const bias = BIAS_LABELS.find(l => clean.includes(l)) ?? 'unknown';
  return { bias, tags: [] };
}

async function classifyWithOllama(title: string, summary: string): Promise<Classification> {
  const prompt = `Title: ${title}\nSummary: ${summary}\n\nClassify:`;
  const resp   = await axios.post(
    `${OLLAMA_BASE}/api/generate`,
    { model: OLLAMA_MODEL, prompt, system: SYSTEM_PROMPT, stream: false },
    { timeout: 45000 },
  );
  return parseClassification((resp.data as { response: string }).response);
}

async function classifyWithClaude(title: string, summary: string): Promise<Classification> {
  const resp = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model:      'claude-haiku-20240307',
      max_tokens: 80,
      system:     SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Title: ${title}\nSummary: ${summary}\n\nClassify:` }],
    },
    {
      headers: {
        'x-api-key':         CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      timeout: 15000,
    },
  );
  const content = (resp.data as { content: Array<{ text: string }> }).content;
  return parseClassification(content[0]?.text ?? '');
}

/**
 * Classify an article's political bias and content topics.
 * Tries Ollama first, falls back to Claude API if configured.
 */
export async function classifyArticle(title: string, summary: string): Promise<Classification> {
  if (OLLAMA_BASE) {
    try {
      return await classifyWithOllama(title, summary);
    } catch (err) {
      console.warn('[classifier] Ollama failed, trying Claude:', (err as Error).message);
    }
  }

  if (CLAUDE_KEY) {
    try {
      return await classifyWithClaude(title, summary);
    } catch (err) {
      console.error('[classifier] Claude API failed:', (err as Error).message);
    }
  }

  return { bias: 'unknown', tags: [] };
}

/** Backward-compat export */
export async function classifyBias(title: string, summary: string): Promise<BiasTag> {
  return (await classifyArticle(title, summary)).bias;
}

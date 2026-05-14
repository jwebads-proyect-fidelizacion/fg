// AI utility - works with OpenAI, Anthropic Claude, or any OpenAI-compatible API
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // openai | anthropic
const AI_API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

export function isAIEnabled() {
  return !!AI_API_KEY;
}

/**
 * Call AI to generate JSON response.
 * Works with OpenAI API (or compatible) and Anthropic.
 */
export async function callAI(systemPrompt, userPrompt, options = {}) {
  if (!AI_API_KEY) {
    throw new Error('AI no configurada. Configura OPENAI_API_KEY o ANTHROPIC_API_KEY en Vercel.');
  }

  const { temperature = 0.7, maxTokens = 1500, jsonMode = true } = options;

  if (AI_PROVIDER === 'anthropic') {
    return callAnthropic(systemPrompt, userPrompt, { temperature, maxTokens, jsonMode });
  }

  return callOpenAI(systemPrompt, userPrompt, { temperature, maxTokens, jsonMode });
}

async function callOpenAI(systemPrompt, userPrompt, opts) {
  const body = {
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };

  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  if (opts.jsonMode) {
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }
  return content;
}

async function callAnthropic(systemPrompt, userPrompt, opts) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: opts.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';

  if (opts.jsonMode) {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return { raw: content };
      }
    }
    return { raw: content };
  }
  return content;
}

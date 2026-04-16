import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Provider-agnostic LLM client.
 * Supports 'anthropic' and 'openai' — swap by setting LLM_PROVIDER in .env.
 *
 * Each provider module is lazy-loaded so you only need the SDK you're using.
 */

let client = null;

function getProvider() {
  const provider = config.llm.provider;
  if (!provider) return null;
  if (provider !== 'anthropic' && provider !== 'openai') {
    throw new Error(`Unknown LLM provider: ${provider}. Use 'anthropic' or 'openai'.`);
  }
  return provider;
}

async function getClient() {
  if (client) return client;

  const provider = getProvider();
  if (!provider) return null;

  if (provider === 'anthropic') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = {
      provider: 'anthropic',
      sdk: new Anthropic({ apiKey: config.llm.apiKey }),
    };
  } else {
    const { default: OpenAI } = await import('openai');
    client = {
      provider: 'openai',
      sdk: new OpenAI({ apiKey: config.llm.apiKey }),
    };
  }

  return client;
}

/**
 * Send a message to the configured LLM and get a text response.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>} the assistant's reply
 */
export async function chat(systemPrompt, userMessage) {
  const c = await getClient();

  if (!c) {
    logger.warn('No LLM configured — returning null');
    return null;
  }

  if (c.provider === 'anthropic') {
    const response = await c.sdk.messages.create({
      model: config.llm.model || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    return response.content[0]?.text || '';
  }

  // OpenAI
  const response = await c.sdk.chat.completions.create({
    model: config.llm.model || 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });
  return response.choices[0]?.message?.content || '';
}

/**
 * Use the LLM to extract a Lego set number from a natural-language query.
 * @param {string} query - e.g. "UCS Millennium Falcon"
 * @returns {Promise<string|null>} set number or null
 */
export async function extractSetNumber(query) {
  const result = await chat(
    `You are a Lego set identification assistant. Given a user query, respond with ONLY the Lego set number (digits only, e.g. "75192"). If you cannot determine the set number, respond with "UNKNOWN".`,
    query
  );

  if (!result || result.trim() === 'UNKNOWN') return null;
  return result.trim().replace(/[^0-9-]/g, '');
}

export default { chat, extractSetNumber };

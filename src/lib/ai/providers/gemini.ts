import { AiError, type ChatMessage, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'
import { getT } from '@/lib/i18n/translate'

const t = getT('LibErrors')

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[]
      role?: string
    }
    finishReason?: string
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

/**
 * Format chat turns for Google Gemini v1beta REST API.
 * Gemini requires role to be 'user' or 'model', and conversation must
 * start with a 'user' turn.
 */
function normalizeForGemini(
  messages: ChatMessage[],
): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  const merged = mergeConsecutive(messages)
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }
  if (merged.length === 0) {
    return [{ role: 'user', parts: [{ text: '(The customer has not sent a message yet.)' }] }]
  }

  return merged.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }))
}

/**
 * Call Google Gemini REST API endpoint directly with the account's API key.
 * Compatible with gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash, etc.
 */
export async function generateGemini(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  // Clean model name (strip leading "models/" if user typed it)
  const cleanModel = (model || 'gemini-1.5-flash').replace(/^models\//, '').trim()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cleanModel,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const payload: Record<string, unknown> = {
    contents: normalizeForGemini(messages),
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
    },
  }

  if (systemPrompt && systemPrompt.trim()) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt.trim() }],
    }
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('Google Gemini', res)
  }

  const data = (await res.json().catch(() => null)) as GeminiResponse | null

  if (data?.error) {
    throw new AiError(`Google Gemini Error: ${data.error.message || data.error.status}`, {
      code: 'provider_error',
      status: 502,
    })
  }

  const parts = data?.candidates?.[0]?.content?.parts
  const text = parts
    ?.filter((p) => typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim()

  if (!text) {
    throw new AiError(t('ai.emptyResponse', { provider: 'Google Gemini' }), {
      code: 'empty_response',
    })
  }

  const usage = normalizeUsage({
    prompt: data?.usageMetadata?.promptTokenCount,
    completion: data?.usageMetadata?.candidatesTokenCount,
    total: data?.usageMetadata?.totalTokenCount,
  })

  return { text, usage }
}

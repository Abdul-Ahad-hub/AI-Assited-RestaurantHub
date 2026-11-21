import { GoogleGenAI } from '@google/genai';

export interface FreeModelSpec {
  id: string;
  supportsJsonSchema: boolean;
  label: string;
}

/**
 * Verified free-tier Gemini & Gemma models available on the Google AI Studio Gemini API,
 * ordered by live reliability, quality, and independent quota buckets.
 * If one model hits 429 (quota/rate limit), 503 (overloaded), or 404 (deprecated),
 * the router puts it on cooldown and automatically switches to the next healthy model.
 */
export const FREE_GEMINI_MODELS: FreeModelSpec[] = [
  { id: 'gemini-3.5-flash-lite', supportsJsonSchema: true, label: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.1-flash-lite', supportsJsonSchema: true, label: 'Gemini 3.1 Flash-Lite' },
  { id: 'gemini-flash-lite-latest', supportsJsonSchema: true, label: 'Gemini Flash-Lite Latest' },
  { id: 'gemini-3.6-flash', supportsJsonSchema: true, label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', supportsJsonSchema: true, label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3-flash-preview', supportsJsonSchema: true, label: 'Gemini 3 Flash Preview' },
  { id: 'gemini-3.8-flash', supportsJsonSchema: true, label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.7-flash', supportsJsonSchema: true, label: 'Gemini 3.7 Flash' },
  { id: 'gemma-4-31b-it', supportsJsonSchema: false, label: 'Gemma 4 31B IT' },
  { id: 'gemma-4-26b-a4b-it', supportsJsonSchema: false, label: 'Gemma 4 26B IT' }
];

// Per-model cooldown timestamps (epoch ms) so exhausted models are skipped automatically
const modelCooldownUntil = new Map<string, number>();

// Cache GoogleGenAI client instances per key
const clientCache = new Map<string, GoogleGenAI>();

function getClient(apiKey: string): GoogleGenAI {
  let client = clientCache.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({ apiKey });
    clientCache.set(apiKey, client);
  }
  return client;
}

function classifyError(err: any): {
  retryable: boolean;
  cooldownMs: number;
  reason: string;
} {
  const status = Number(err?.status || err?.code || err?.error?.code || 0);
  const msg = String(err?.message || err?.error?.message || err || '').toLowerCase();

  // Invalid API key / auth failure: do not loop through all models
  if (
    status === 401 ||
    (status === 403 && (msg.includes('api key') || msg.includes('invalid') || msg.includes('permission')))
  ) {
    return { retryable: false, cooldownMs: 0, reason: 'invalid_api_key' };
  }

  // Quota / Rate Limit (429 RESOURCE_EXHAUSTED)
  if (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit')
  ) {
    const isDaily = msg.includes('per day') || msg.includes('daily') || msg.includes('rpd');
    return {
      retryable: true,
      cooldownMs: isDaily ? 30 * 60 * 1000 : 5 * 60 * 1000,
      reason: isDaily ? 'daily_quota_exhausted' : 'rate_limited_429'
    };
  }

  // Temporary overload / unavailable (503 / 500)
  if (
    status === 503 ||
    status === 500 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('high demand')
  ) {
    return { retryable: true, cooldownMs: 60 * 1000, reason: 'unavailable_503' };
  }

  // Deprecated / missing model (404)
  if (status === 404 || msg.includes('404') || msg.includes('not_found') || msg.includes('not found')) {
    return { retryable: true, cooldownMs: 60 * 60 * 1000, reason: 'not_found_404' };
  }

  // Any other transient model failure: short cooldown and try next model
  return { retryable: true, cooldownMs: 30 * 1000, reason: 'model_error' };
}

export interface FailoverGenerateParams {
  contents: any;
  config?: Record<string, any>;
  requireJsonSchema?: boolean;
  perModelTimeoutMs?: number;
  maxAttempts?: number;
}

export interface FailoverGenerateResult {
  text: string;
  modelUsed: string;
  attemptedModels: string[];
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms on ${label}`));
    }, ms);
    promise.then(
      val => {
        clearTimeout(timer);
        resolve(val);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function generateWithFreeModelFailover(
  apiKey: string,
  params: FailoverGenerateParams
): Promise<FailoverGenerateResult> {
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey || trimmedKey === 'PLACEHOLDER_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const ai = getClient(trimmedKey);
  const now = Date.now();
  const perModelTimeoutMs = params.perModelTimeoutMs ?? 9000;
  const maxAttempts = params.maxAttempts ?? 4;
  const eligible = FREE_GEMINI_MODELS.filter(
    m => !params.requireJsonSchema || m.supportsJsonSchema
  );

  // Try healthy (non-cooled-down) models first, then cooled-down models ordered by earliest expiry
  const healthy = eligible.filter(m => (modelCooldownUntil.get(m.id) || 0) <= now);
  const cooling = eligible
    .filter(m => (modelCooldownUntil.get(m.id) || 0) > now)
    .sort((a, b) => (modelCooldownUntil.get(a.id) || 0) - (modelCooldownUntil.get(b.id) || 0));

  const orderedCandidates = [...healthy, ...cooling].slice(0, maxAttempts);
  const attemptedModels: string[] = [];
  let lastError: any = null;

  for (const candidate of orderedCandidates) {
    attemptedModels.push(candidate.id);
    try {
      const callConfig =
        candidate.supportsJsonSchema || !params.config
          ? params.config
          : {
              ...params.config,
              responseMimeType: undefined,
              responseSchema: undefined
            };

      const resp = await withTimeout(
        ai.models.generateContent({
          model: candidate.id,
          contents: params.contents,
          ...(callConfig ? { config: callConfig } : {})
        }),
        perModelTimeoutMs,
        candidate.id
      );

      const text = (resp.text || '').trim();
      if (text) {
        // Clear any stale cooldown on success
        modelCooldownUntil.delete(candidate.id);
        return {
          text,
          modelUsed: candidate.id,
          attemptedModels
        };
      }
      throw new Error(`Empty response from ${candidate.id}`);
    } catch (err: any) {
      lastError = err;
      const info = classifyError(err);
      if (info.cooldownMs > 0) {
        modelCooldownUntil.set(candidate.id, Date.now() + info.cooldownMs);
      }
      console.warn(
        `[Gemini Router] ${candidate.id} failed (${info.reason}), switching to next free model...`
      );
      if (!info.retryable) {
        break;
      }
    }
  }

  throw lastError || new Error('All free Gemini models are currently unavailable.');
}

export function getGeminiModelPoolStatus() {
  const now = Date.now();
  return FREE_GEMINI_MODELS.map(m => {
    const until = modelCooldownUntil.get(m.id) || 0;
    return {
      id: m.id,
      label: m.label,
      available: until <= now,
      cooldownSecondsRemaining: until > now ? Math.ceil((until - now) / 1000) : 0
    };
  });
}

export function resetModelCooldowns() {
  modelCooldownUntil.clear();
}

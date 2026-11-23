import { fetchWithTimeout } from './fetch-timeout';

export type GeminiServerCheck =
  | { ok: true; model: string }
  | { ok: false; code: 'unreachable' | 'not_manguare' | 'gemini_not_configured' |
      'gemini_api_key_format_invalid' | 'gemini_token_unavailable' | 'rate_limit_exceeded' |
      'unexpected_response' };

/** Comprueba la API y la emisión real de un token temporal, sin guardar el token. */
export async function checkGeminiServer(base: string): Promise<GeminiServerCheck> {
  try {
    const health = await fetchWithTimeout(`${base}/api/health`, { cache: 'no-store' }, 8_000);
    const healthData = await health.json().catch(() => ({})) as { ok?: boolean };
    if (!health.ok || healthData.ok !== true) return { ok: false, code: 'not_manguare' };

    const response = await fetchWithTimeout(`${base}/api/gemini/token`, {
      method: 'POST', cache: 'no-store',
    }, 15_000);
    const data = await response.json().catch(() => ({})) as {
      error?: string; token?: string; model?: string;
    };
    if (response.ok && data.token && data.model) return { ok: true, model: data.model };
    if (data.error === 'gemini_not_configured' ||
        data.error === 'gemini_api_key_format_invalid' ||
        data.error === 'gemini_token_unavailable' ||
        data.error === 'rate_limit_exceeded') {
      return { ok: false, code: data.error };
    }
    return { ok: false, code: 'unexpected_response' };
  } catch {
    return { ok: false, code: 'unreachable' };
  }
}

// Gemini through its REST API, behind a tiny interface so tests use a fake and the provider can change.
// Models are tried in order with a short timeout each: on Oct 31 `gemini-flash-latest` returned 503
// "high demand" and took 58 s once, so one model is never enough. Override with GEMINI_MODELS.

export interface Llm {
  /** Plain-text completion. Throws LlmError if every model fails. */
  /** Plain-text completion. `audio` (base64) lets the model listen, e.g. to a voice note. */
  complete(p: { system: string; user: string; maxOutputTokens?: number; audio?: { mimeType: string; data: string }; timeoutMs?: number }): Promise<string>;
}

export class LlmError extends Error {}

// Measured Nov 1: 3.5-flash-lite ≈1 s; 3.1-flash-lite returned 503 after 12–15 s (overloaded). Fail fast, move on.
export const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];

export function geminiLlm(opts: { apiKey: string; models?: string[]; timeoutMs?: number; fetchImpl?: typeof fetch }): Llm {
  const models = opts.models?.length ? opts.models : DEFAULT_MODELS;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const f = opts.fetchImpl ?? fetch;
  return {
    async complete({ system, user, maxOutputTokens = 1024, audio, timeoutMs: callTimeout }) {
      const errors: string[] = [];
      for (const model of models) {
        try {
          const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            signal: AbortSignal.timeout(callTimeout ?? timeoutMs),
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [...(audio ? [{ inlineData: audio }] : []), { text: user }] }],
              generationConfig: { temperature: 0, maxOutputTokens },
            }),
          });
          const json = (await res.json().catch(() => null)) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
            error?: { code?: number; status?: string };
          } | null;
          const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
          if (res.ok && text) return text;
          errors.push(`${model}: ${json?.error?.code ?? res.status} ${json?.error?.status ?? 'empty'}`);
        } catch (e) {
          errors.push(`${model}: ${(e as Error).name}`);
        }
      }
      throw new LlmError(`all models failed (${errors.join('; ')})`);
    },
  };
}

// ---- translation -------------------------------------------------------------------------------

export const TRANSLATE_SYSTEM =
  'You translate short chat messages between college students and their mentors or hostel staff. ' +
  'Translate faithfully into the target language. Keep the tone, names and every detail, especially words about ' +
  'difficulty, money, health or feelings; never soften or drop them. If the text is already in the target ' +
  'language, return it unchanged. Output only the translation, with no notes or quotes.';

export async function translateWithLlm(llm: Llm, text: string, to: string) {
  return llm.complete({ system: TRANSLATE_SYSTEM, user: `Target language code: ${to}\n\n${text}`, maxOutputTokens: 1024 });
}

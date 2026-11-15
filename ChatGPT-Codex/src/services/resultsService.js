import { BACKEND_URL, backendHttpUrl } from './backendConfig.js';
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export function validateResults(data) {
  if (!object(data)) throw new Error('The results file must contain a JSON object.');
  for (const key of ['asr', 'mt', 's2t', 'hinglish', 'latencyMs', 'worst']) {
    if (data[key] !== undefined && !(key === 'worst' ? Array.isArray(data[key]) : object(data[key]))) throw new Error(`Invalid results section: ${key}.`);
  }
  const check = (row, keys) => {
    if (!object(row)) throw new Error('Invalid results row.');
    for (const key of keys) if (row[key] != null && !(typeof row[key] === 'number' && Number.isFinite(row[key]) && row[key] >= 0)) throw new Error(`Invalid measurement: ${key}.`);
  };
  Object.values(data.asr ?? {}).forEach((row) => check(row, ['wer', 'n']));
  Object.values(data.mt ?? {}).forEach((row) => { check(row, ['n']); for (const engine of ['copy', 'nllb', 'gemini']) if (row[engine] != null) check(row[engine], ['chrf']); });
  if (data.hinglish) { check(data.hinglish, ['n']); for (const model of ['baseline', 'fix']) if (data.hinglish[model] != null) check(data.hinglish[model], ['wer', 'chrf']); }
  if (data.hinglish?.note != null && typeof data.hinglish.note !== 'string') throw new Error('Invalid Hinglish note.');
  if (data.hinglish?.speech != null) {
    check(data.hinglish.speech, ['human_recordings', 'computer_recordings']);
    if (data.hinglish.speech.computer_voice != null && typeof data.hinglish.speech.computer_voice !== 'string') throw new Error('Invalid computer voice.');
  }
  for (const row of Object.values(data.s2t ?? {})) {
    if (!object(row)) throw new Error('Invalid speech-to-translation row.');
    check(row, Object.keys(row));
  }
  if (data.latencyMs) check(data.latencyMs, ['asr', 'mt', 'tts']);
  for (const row of data.worst ?? []) if (!object(row) || ['lang', 'input', 'model', 'correct', 'why', 'task', 'pair'].some((key) => row[key] != null && typeof row[key] !== 'string')) throw new Error('Invalid failure example.');
  for (const row of data.worst ?? []) if (row.score != null && !(typeof row.score === 'string' || (typeof row.score === 'number' && Number.isFinite(row.score) && row.score >= 0))) throw new Error('Invalid failure score.');
  if (data.generated != null && typeof data.generated !== 'string') throw new Error('Invalid generation date.');
  return data;
}
export function hasMeasurements(data) {
  return ['asr', 'mt', 's2t', 'hinglish', 'latencyMs'].some((key) => Object.keys(data[key] ?? {}).length > 0) || (data.worst?.length ?? 0) > 0;
}

/** Preserve zero counts and expose speech provenance beside the Hinglish scores. */
export function getHinglishProvenance(hinglish) {
  const items = [];
  const speech = hinglish?.speech;
  if (speech?.human_recordings != null) items.push(`Human recordings: ${speech.human_recordings}`);
  if (speech?.computer_recordings != null) items.push(`Computer-made recordings: ${speech.computer_recordings}`);
  if (speech?.computer_voice) items.push(`Computer voice: ${speech.computer_voice}`);
  return { note: hinglish?.note ?? null, items };
}

async function readSource(url, { signal, fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  let timer, onAbort;
  const stop = new Promise((_, reject) => {
    onAbort = () => { controller.abort(); reject(new DOMException('Results request aborted.', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) return onAbort();
    timer = setTimeout(() => { controller.abort(); reject(new Error('Results request timed out.')); }, timeoutMs);
  });
  const request = async () => {
    if (signal?.aborted) throw new DOMException('Results request aborted.', 'AbortError');
    const response = await fetchImpl(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return validateResults(await response.json());
  };
  try { return await Promise.race([request(), stop]); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}
export async function loadResults({ signal, fetchImpl = fetch, backendUrl = BACKEND_URL, timeoutMs = 8000 } = {}) {
  const publicUrl = `${import.meta.env?.BASE_URL ?? '/'}results.json`;
  const sources = backendUrl ? [backendHttpUrl('/results', backendUrl), publicUrl] : [publicUrl];
  let backendError;
  for (const url of sources) {
    try {
      const data = await readSource(url, { signal, fetchImpl, timeoutMs });
      return { data, source: url, sourceLabel: backendUrl && url === sources[0] ? 'Backend evaluation file' : 'Published evaluation file', notice: backendError ? 'Backend results unavailable. Showing the published evaluation file; check its generation date.' : null };
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error;
      backendError = error;
    }
  }
  throw new Error('No evaluation results are available yet. Run the Part A evaluation and serve results.json through the backend, or place it in public/results.json.');
}

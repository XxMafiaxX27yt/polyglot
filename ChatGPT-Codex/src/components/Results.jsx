import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Logo from './Logo.jsx';
import { LANGUAGES } from '../data/languages.js';
import { getHinglishProvenance, hasMeasurements, loadResults } from '../services/resultsService.js';
import './results.css';
const measured = (v) => typeof v === 'number' && Number.isFinite(v);
const metric = (v, suffix = '') => measured(v) ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v)}${suffix}` : 'Not reported';
const wer = (v) => measured(v) ? metric(v * 100, '%') : 'Not reported';
const language = (code) => code === 'hinglish' ? 'Hinglish' : LANGUAGES.find((item) => item.code === code)?.name ?? code;
const text = (v) => v?.trim() ? v : 'Not reported';
function DataTable({ caption, headers, rows }) {
  return <div className="results-table-wrap" role="region" aria-label={caption} tabIndex={0}><table className="results-table"><caption>{caption}</caption><thead><tr>{headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((cells, i) => <tr key={i}>{cells.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
export default function Results({ onBack }) {
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    loadResults({ signal: controller.signal }).then((result) => { if (!controller.signal.aborted) setState(result); }, (error) => { if (!controller.signal.aborted) setState({ error: error.message }); });
    return () => controller.abort();
  }, [reload]);
  const data = state.data;
  const asr = Object.entries(data?.asr ?? {});
  const mt = Object.entries(data?.mt ?? {});
  const showGemini = mt.some(([, row]) => row.gemini != null);
  const provenance = getHinglishProvenance(data?.hinglish);
  const s2t = Object.entries(data?.s2t ?? {}).flatMap(([code, routes]) => Object.entries(routes).map(([route, score]) => [code.split('-').map(language).join(' → '), route, metric(score)]));
  const failures = (data?.worst ?? []).slice(0, 5);
  const generated = data?.generated && !Number.isNaN(Date.parse(data.generated)) ? new Date(data.generated).toLocaleString() : null;
  return <main className="results-page">
    <header className="results-nav"><Logo /><button className="btn-ghost" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Back</button></header>
    <section className="results-heading"><p className="eyebrow">Evaluation · Part A</p><h1>Measured results</h1><p>Language-by-language scores, model comparisons and failure examples from the evaluation file. Simulated call metrics are never used here.</p><button className="btn-ghost results-refresh" disabled={state.loading} onClick={() => setReload((v) => v + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh results</button></section>
    {state.loading && <div className="results-state" role="status">Loading evaluation results…</div>}
    {state.error && <div className="results-state" role="alert"><h2>No evaluation results available</h2><p>{state.error}</p><button className="btn-primary" onClick={() => setReload((v) => v + 1)}>Try again</button></div>}
    {data && <>
      <aside className="results-provenance"><strong>{state.sourceLabel}</strong><span>Generated: {generated ?? 'Not reported'}</span><a href={state.source} target="_blank" rel="noreferrer">Open source JSON</a></aside>
      {state.notice && <p className="results-notice" role="status">{state.notice}</p>}
      {!hasMeasurements(data) && <div className="results-state"><h2>No measurements in this file</h2><p>The file loaded, but no scores or failure examples have been reported.</p></div>}
      {hasMeasurements(data) && <div className="results-sections">
        <section className="results-card"><h2>Speech recognition</h2><p>Word error rate (WER): lower is better. WER is shown as a percentage.</p>{asr.length ? <DataTable caption="ASR scores per language" headers={['Language', 'WER ↓', 'Samples (n)']} rows={asr.map(([code, row]) => [language(code), wer(row.wer), metric(row.n)])} /> : <p className="results-missing">No speech recognition scores reported.</p>}</section>
        <section className="results-card"><h2>Translation: baseline vs ours</h2><p>Character F-score (chrF): higher is better. Copy leaves the input untranslated; NLLB is our translation engine. Gemini appears when evaluated.</p>{mt.length ? <DataTable caption="MT scores by language pair" headers={['Language pair', 'Copy baseline chrF ↑', 'NLLB chrF ↑', ...(showGemini ? ['Gemini chrF ↑'] : []), 'Samples (n)']} rows={mt.map(([code, row]) => [code.split('-').map(language).join(' → '), metric(row.copy?.chrf), metric(row.nllb?.chrf), ...(showGemini ? [metric(row.gemini?.chrf)] : []), metric(row.n)])} /> : <p className="results-missing">No translation scores reported.</p>}</section>
        <section className="results-card"><h2>Hinglish: baseline vs ours</h2><p>Hindi mixed with English. Samples: {metric(data.hinglish?.n)}. chrF compares the translation outputs; higher is better.</p>
          {provenance.note && <p className="results-speech-note">{provenance.note}</p>}
          {provenance.items.length > 0 && <ul className="results-speech-provenance" aria-label="Hinglish speech provenance">{provenance.items.map((item) => <li key={item}>{item}</li>)}</ul>}
          {data.hinglish && (data.hinglish.baseline || data.hinglish.fix) ? <><DataTable caption="Hinglish baseline and fix" headers={['Model', 'chrF ↑', 'WER ↓']} rows={[
            ['Baseline', metric(data.hinglish.baseline?.chrf), data.hinglish.baseline?.wer === null ? 'Not applicable' : wer(data.hinglish.baseline?.wer)],
            ['Ours (fix)', metric(data.hinglish.fix?.chrf), data.hinglish.fix?.wer === null ? 'Not applicable' : wer(data.hinglish.fix?.wer)],
          ]} />{(data.hinglish.baseline?.wer === null || data.hinglish.fix?.wer === null) && <p className="results-metric-note">WER is not used for this Hinglish evaluation: Latin and Devanagari transcripts make word matching unfair. Compare the chrF scores.</p>}</> : <p className="results-missing">No Hinglish comparison reported.</p>}</section>
        <section className="results-card"><h2>Stage latency</h2><p>Evaluation timings in milliseconds, separate from live end-to-end measurements.</p>{data.latencyMs && Object.keys(data.latencyMs).length ? <DataTable caption="Evaluation stage timings" headers={['Stage', 'Time (ms)']} rows={[
          ['Speech recognition (ASR)', metric(data.latencyMs.asr)], ['Translation (MT)', metric(data.latencyMs.mt)], ['Speech synthesis (TTS)', metric(data.latencyMs.tts)],
        ]} /> : <p className="results-missing">No stage timings reported.</p>}</section>
        {s2t.length > 0 && <section className="results-card results-s2t"><h2>Speech to translated text</h2><p>chrF by route. The perfect-transcript route measures translation alone; speech routes include recognition errors.</p><DataTable caption="Speech-to-translation routes" headers={['Language pair', 'Route', 'chrF ↑']} rows={s2t} /></section>}
        <section className="results-card results-failures"><h2>Worst five: side by side</h2><p>Examples in the order supplied by Part A. Displaying {failures.length} of up to five.</p>{failures.length ? failures.map((failure, index) => <article className="results-failure" key={index}>
          <h3><span>{String(index + 1).padStart(2, '0')}</span> {language(failure.lang ?? 'Not reported')}</h3>
          {(failure.task || failure.pair || failure.score != null) && <p className="results-failure-meta">{[failure.task, failure.pair && failure.pair.split('-').map(language).join(' → '), failure.score != null ? (typeof failure.score === 'number' ? metric(failure.score) : failure.score) : null].filter((value) => value != null && value !== '').join(' · ')}</p>}
          <p className="results-input"><strong>Input</strong><span dir="auto">{text(failure.input)}</span></p>
          <div className="results-comparison"><div><h4>Model output</h4><p dir="auto">{text(failure.model)}</p></div><div><h4>Correct output</h4><p dir="auto">{text(failure.correct)}</p></div></div>
          <p className="results-why"><strong>Why it failed</strong> {text(failure.why)}</p>
        </article>) : <p className="results-missing">No failure examples reported.</p>}</section>
      </div>}
      <footer className="results-footer">Scope: Hindi, English, Tamil, Bengali and Hinglish. The other 16 catalogue languages are untested. Missing values are never filled with demo numbers.</footer>
    </>}
  </main>;
}

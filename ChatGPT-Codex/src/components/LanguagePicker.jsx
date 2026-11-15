import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { LANGUAGES, isTestedLanguage } from '../data/languages.js';

/** Searchable catalogue with sixteen untested languages. */
export function LanguageGrid({ value, onChange, autoFocus = false }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code === q
    );
  }, [query]);

  return (
    <div className="lang-picker">
<p className="lang-scope">Tested scope: Hindi, English, Tamil, Bengali and Hinglish. Other languages are untested.</p>
      <label className="lang-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search 20 languages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          aria-label="Search languages"
        />
      </label>
      <div className="lang-grid" role="radiogroup" aria-label="Speaking and listening language">
        {results.map((l) => {
          const selected = l.code === value;
          return (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`lang-card${selected ? ' selected' : ''}`}
              onClick={() => onChange(l.code)}
            >
              <span className="lang-native" lang={l.code}>
                {l.native}
              </span>
              <span className="lang-name">{l.name}</span>
{!isTestedLanguage(l.code) && <small className="lang-untested">Untested</small>}
              {selected && <Check className="lang-check" size={14} aria-hidden="true" />}
            </button>
          );
        })}
        {results.length === 0 && <p className="lang-empty">No language matches “{query}”.</p>}
      </div>
    </div>
  );
}

/** Modal wrapper used inside the call. */
export function LanguageModal({ value, onChange, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose speaking and listening language"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>I speak / want to hear</h2>
            <p>Your choice also tells speech recognition which language you speak. Hinglish speakers choose Hindi. Languages marked untested have no validated support.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <LanguageGrid
          value={value}
          autoFocus
          onChange={(code) => {
            onChange(code);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

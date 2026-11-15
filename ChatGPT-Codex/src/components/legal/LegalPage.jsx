import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react';
import Logo from '../Logo.jsx';
import { DOCUMENTS, LEGAL_DOCS, getDocument } from '../../legal/documents.js';
import { POLICY_STATUS, POLICY_UPDATED, POLICY_VERSION, REGIONS, getRegion } from '../../legal/config.js';
import { getRegionId, setRegionId } from '../../services/privacyService.js';
import { closeOverlay } from '../../utils/route.js';

/** Renders text, highlighting [placeholders] that still need the operator's confirmation. */
export function Marked({ text }) {
  return text.split(/(\[[^\]]+\])/).map((part, i) =>
    part.startsWith('[') ? (
      <mark key={i} className="ph" title="Placeholder — to be confirmed before launch">
        {part.slice(1, -1)}
      </mark>
    ) : (
      part
    )
  );
}

/** Full-screen page that sits on top of the app. Shared by legal documents and Help. */
export function OverlayPage({ label, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeOverlay();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="legal-layer" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
      <header className="legal-top">
        <Logo size="sm" />
        <button className="btn-ghost" onClick={closeOverlay}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Polyglot
        </button>
      </header>
      {children}
      <footer className="legal-foot">
        <a href="#/legal">All policies</a>
        <a href="#/help">Help &amp; Privacy Support</a>
        <span>Policies last updated {POLICY_UPDATED}</span>
      </footer>
    </div>
  );
}

export function RegionNotes() {
  const [id, setId] = useState(getRegionId);
  const region = getRegion(id);
  return (
    <section id="region" className="legal-region">
      <h2>Notes for your region</h2>
      <label className="field">
        <span>Where do you live?</span>
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setRegionId(e.target.value);
          }}
        >
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        <b>Law that may apply:</b> {region.law}
      </p>
      <p>
        <b>Rights you may have:</b>
      </p>
      <ul>
        {region.rights.map((r) => (
          <li key={r}>
            <Marked text={r} />
          </li>
        ))}
      </ul>
      <p>
        <b>International transfers:</b> <Marked text={region.transfers} />
      </p>
      <p>
        <b>Age:</b> <Marked text={region.age} />
      </p>
      <p className="legal-fine">
        These notes are a starting point for legal review. They are not a statement that Polyglot complies with these
        laws.
      </p>
    </section>
  );
}

const slug = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function Document({ doc }) {
  // In-page jumps are done in code because the address hash is used for routing.
  const jump = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <article className="legal-doc">
      <p className="eyebrow">{doc.notLegal ? 'Company' : 'Legal & Privacy'}</p>
      <h1>{doc.title}</h1>
      <p className="legal-summary">{doc.summary}</p>
      {!doc.notLegal && (
        <p className="legal-meta">
          <span>Last updated {POLICY_UPDATED}</span>
          <span>Version {POLICY_VERSION}</span>
          <span className="legal-draft">{POLICY_STATUS}</span>
        </p>
      )}

      {doc.sections.length > 4 && (
        <nav className="legal-toc" aria-label="On this page">
          <strong>On this page</strong>
          <ol>
            {doc.sections.map((s) => (
              <li key={s.h}>
                <a href={`#${slug(s.h)}`} onClick={jump(slug(s.h))}>
                  {s.h}
                </a>
              </li>
            ))}
            {doc.regional && (
              <li>
                <a href="#region" onClick={jump('region')}>
                  Notes for your region
                </a>
              </li>
            )}
          </ol>
        </nav>
      )}

      {doc.sections.map((s) => (
        <section key={s.h} id={slug(s.h)}>
          <h2>{s.h}</h2>
          {s.p?.slice(0, s.list ? 1 : undefined).map((t) => (
            <p key={t}>
              <Marked text={t} />
            </p>
          ))}
          {s.list && (
            <ul>
              {s.list.map((t) => (
                <li key={t}>
                  <Marked text={t} />
                </li>
              ))}
            </ul>
          )}
          {s.list &&
            s.p?.slice(1).map((t) => (
              <p key={t}>
                <Marked text={t} />
              </p>
            ))}
          {s.table && (
            <div className="legal-table">
              <table>
                <thead>
                  <tr>
                    {s.table.head.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.table.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, i) => (
                        <td key={i}>
                          <Marked text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {doc.regional && <RegionNotes />}

      <section className="legal-related">
        <h2>Related</h2>
        <div>
          {doc.related.map((id) => (
            <a key={id} href={`#/legal/${id}`}>
              {getDocument(id).title}
              <ChevronRight size={14} aria-hidden="true" />
            </a>
          ))}
          <a href="#/help">
            Help &amp; Privacy Support
            <ChevronRight size={14} aria-hidden="true" />
          </a>
        </div>
      </section>
    </article>
  );
}

function Index() {
  return (
    <article className="legal-doc">
      <p className="eyebrow">Legal &amp; Privacy</p>
      <h1>Policies</h1>
      <p className="legal-summary">How Polyglot handles your information and what we expect from everyone who uses it.</p>
      <p className="legal-meta">
        <span>Last updated {POLICY_UPDATED}</span>
        <span className="legal-draft">{POLICY_STATUS}</span>
      </p>
      <div className="legal-index">
        {LEGAL_DOCS.map((d) => (
          <a key={d.id} href={`#/legal/${d.id}`}>
            <FileText size={18} aria-hidden="true" />
            <span>
              <strong>{d.title}</strong>
              {d.summary}
            </span>
          </a>
        ))}
      </div>
      <p className="legal-fine">
        These documents are drafts for a student project. Highlighted text marks details the operator still has to
        confirm. Having these pages does not by itself make Polyglot legally compliant.
      </p>
    </article>
  );
}

export default function LegalPage({ docId }) {
  const doc = docId ? getDocument(docId) : null;
  const layer = useRef(null);

  useEffect(() => {
    layer.current?.closest('.legal-layer')?.scrollTo(0, 0);
  }, [docId]);

  return (
    <OverlayPage label={doc?.title ?? 'Legal and privacy'}>
      <div className="legal-body" ref={layer}>
        <nav className="legal-nav" aria-label="Policies">
          {DOCUMENTS.filter((d) => !d.notLegal).map((d) => (
            <a key={d.id} href={`#/legal/${d.id}`} aria-current={d.id === docId ? 'page' : undefined}>
              {d.title}
            </a>
          ))}
        </nav>
        {doc ? (
          <Document doc={doc} />
        ) : docId ? (
          <article className="legal-doc">
            <h1>Page not found</h1>
            <p className="legal-summary">There is no policy at this address.</p>
            <a className="btn-ghost" href="#/legal">
              See all policies
            </a>
          </article>
        ) : (
          <Index />
        )}
      </div>
    </OverlayPage>
  );
}

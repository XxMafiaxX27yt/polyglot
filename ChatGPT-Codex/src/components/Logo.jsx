export default function Logo({ size = 'md', tagline = false }) {
  return (
    <div className={`logo logo-${size}`}>
      <svg className="logo-mark" viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M4 9a5 5 0 0 1 5-5h13a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-7l-6 5v-5a5 5 0 0 1-5-5z"
          fill="var(--orange)"
        />
        <path
          d="M30.5 15H30v3.5a7 7 0 0 1-7 7h-6.2a4.5 4.5 0 0 0 4 2.5H26l5 4.5V28h.5a4.5 4.5 0 0 0 4.5-4.5v-4a4.5 4.5 0 0 0-4.5-4.5z"
          fill="var(--text)"
        />
      </svg>
      <div>
        <div className="logo-word" aria-label="Polyglot">
          POLY<span>GLOT</span>
        </div>
        {tagline && <div className="logo-tag">Speak your language. Hear theirs.</div>}
      </div>
    </div>
  );
}

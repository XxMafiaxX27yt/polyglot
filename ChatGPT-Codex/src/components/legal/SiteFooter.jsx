import Logo from '../Logo.jsx';
import { Marked } from './LegalPage.jsx';
import { OPERATOR, POLICY_STATUS, POLICY_UPDATED } from '../../legal/config.js';
import { openCookieChoices } from '../../services/privacyService.js';

const COLUMNS = [
  ['Company', [['About POLYGLOT', '#/legal/about'], ['Contact', '#/help/support'], ['Support', '#/help']]],
  ['Legal', [['Privacy Policy', '#/legal/privacy'], ['Terms of Service', '#/legal/terms'], ['Cookie Policy', '#/legal/cookies'], ['AI Transparency', '#/legal/ai']]],
  ['Safety', [['Community Guidelines', '#/legal/community'], ['Acceptable Use Policy', '#/legal/acceptable-use'], ['Report Abuse', '#/help/abuse'], ['Privacy Requests', '#/help/data']]],
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <Logo size="sm" />
          <p>Speak your language. Hear theirs.</p>
        </div>
        {COLUMNS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <h2>{title}</h2>
            {links.map(([label, href]) => (
              <a key={label} href={href}>
                {label}
              </a>
            ))}
          </nav>
        ))}
      </div>
      <div className="site-footer-base">
        <span>
          © 2026 POLYGLOT. Operator: <Marked text={OPERATOR.name} />
        </span>
        <span>
          Policies last updated {POLICY_UPDATED} · {POLICY_STATUS}
        </span>
        <span className="site-footer-links">
          <a href="#/legal">All policies</a>
          <button type="button" onClick={openCookieChoices}>
            Cookie choices
          </button>
        </span>
      </div>
    </footer>
  );
}

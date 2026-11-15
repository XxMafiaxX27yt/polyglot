import { useState } from 'react';
import { OverlayPage, Marked } from './LegalPage.jsx';
import RequestStatus from './RequestStatus.jsx';
import { OPERATOR } from '../../legal/config.js';
import { submitSupportRequest } from '../../services/privacyService.js';
import { useRequest } from '../../hooks/useRequest.js';

const TYPES = [
  ['support', 'General support'],
  ['privacy', 'Privacy complaint'],
  ['data', 'Data protection request'],
  ['abuse', 'Report abuse'],
  ['security', 'Security issue'],
];

const DATA_KINDS = [
  ['access', 'See or get a copy of my data'],
  ['correct', 'Correct my data'],
  ['delete', 'Delete my data'],
  ['withdraw', 'Withdraw consent'],
  ['other', 'Something else'],
];

const CONTACTS = [
  ['General support', OPERATOR.supportEmail],
  ['Privacy questions and complaints', OPERATOR.privacyEmail],
  ['Abuse reports', OPERATOR.abuseEmail],
  ['Security incidents', OPERATOR.securityEmail],
  ['Grievance contact', OPERATOR.grievanceOfficer],
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function HelpPage({ topic, user }) {
  const [type, setType] = useState(TYPES.some(([id]) => id === topic) ? topic : 'support');
  const [email, setEmail] = useState(user?.email ?? '');
  const [kind, setKind] = useState('access');
  const [meetingId, setMeetingId] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const request = useRequest();

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!EMAIL.test(email.trim())) found.email = 'Enter an email address we can reply to.';
    if (message.trim().length < 10) found.message = 'Please describe the issue in at least 10 characters.';
    setErrors(found);
    if (Object.keys(found).length) return;

    await request.run(
      () =>
        submitSupportRequest({
          type,
          email: email.trim(),
          message: message.trim(),
          ...(type === 'data' && { kind }),
          ...(type === 'abuse' && meetingId.trim() && { meetingId: meetingId.trim() }),
        }),
      (res) => (res?.reference ? `Received. Your reference number is ${res.reference}.` : 'Received.')
    );
  }

  return (
    <OverlayPage label="Help and privacy support">
      <div className="legal-body single">
        <article className="legal-doc">
          <p className="eyebrow">Support</p>
          <h1>Help &amp; Privacy Support</h1>
          <p className="legal-summary">
            Ask for help, raise a privacy complaint, make a data request, or report abuse or a security problem.
          </p>

          <section>
            <h2>In an emergency</h2>
            <p>
              Polyglot is not an emergency service and cannot contact one for you. If someone is in danger, call your
              local emergency number.
            </p>
          </section>

          <section>
            <h2>Contacts</h2>
            <dl className="help-contacts">
              {CONTACTS.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <Marked text={value} />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="legal-fine">
              Highlighted contacts have not been supplied by the operator yet. Expected response time:{' '}
              <Marked text={OPERATOR.responseTime} />
            </p>
          </section>

          <section>
            <h2>Send a request</h2>
            <form className="help-form" onSubmit={submit} noValidate>
              <label className="field">
                <span>What is this about?</span>
                <select value={type} onChange={(e) => (setType(e.target.value), request.reset())}>
                  {TYPES.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {type === 'data' && (
                <label className="field">
                  <span>What would you like to do?</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    {DATA_KINDS.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <em className="help">Signed-in users can also do this from Privacy &amp; Security in their account.</em>
                </label>
              )}

              {type === 'abuse' && (
                <label className="field">
                  <span>Meeting ID (optional)</span>
                  <input value={meetingId} onChange={(e) => setMeetingId(e.target.value)} maxLength={40} spellCheck={false} placeholder="PLG-XXXX-XXXX" />
                  <em className="help">Reports are private. The person you report is not told who reported them.</em>
                </label>
              )}

              {type === 'security' && (
                <p className="notice">Please do not include passwords, tokens or other people’s personal data in your message.</p>
              )}

              <label className="field">
                <span>Your email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errors.email} />
                {errors.email && <em className="err">{errors.email}</em>}
              </label>

              <label className="field">
                <span>Details</span>
                <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} aria-invalid={!!errors.message} />
                {errors.message && <em className="err">{errors.message}</em>}
              </label>

              <div className="help-submit">
                <button className="mbtn primary big" type="submit" disabled={request.busy || request.status === 'ok'}>
                  {request.busy ? 'Sending…' : 'Send request'}
                </button>
                <RequestStatus request={request} />
              </div>
            </form>
          </section>
        </article>
      </div>
    </OverlayPage>
  );
}

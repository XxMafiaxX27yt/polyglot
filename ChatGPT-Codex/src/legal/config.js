// Operator-editable legal configuration.
//
// Everything in [square brackets] is a PLACEHOLDER that the platform operator
// or legal counsel must replace before public launch. The UI highlights these
// so nobody mistakes a draft for a finished policy. Changing text here (and in
// documents.js) updates every page — no component needs to change.

/** Bump this whenever the Terms or Privacy Policy change: users are asked to consent again. */
export const POLICY_VERSION = '0.1-draft';
export const POLICY_UPDATED = '14 November 2026';
export const POLICY_STATUS = 'Draft — not yet reviewed by legal counsel';

export const OPERATOR = {
  name: '[Operator legal name — to be confirmed]',
  address: '[Registered address — to be confirmed]',
  supportEmail: '[Support email — to be confirmed]',
  privacyEmail: '[Privacy contact email — to be confirmed]',
  abuseEmail: '[Abuse reporting email — to be confirmed]',
  securityEmail: '[Security contact email — to be confirmed]',
  grievanceOfficer: '[Grievance officer name and contact details — to be appointed and confirmed]',
  governingLaw: '[Governing law and courts — to be confirmed by legal counsel]',
  aiProviders: '[Speech-to-text, translation and text-to-speech providers — to be confirmed]',
  mediaProvider: '[Real-time media provider and server region — to be confirmed]',
  hostingProvider: '[Hosting and database provider and region — to be confirmed]',
  minAge: '[Minimum age and parental-consent process — to be set after legal review]',
  accountRetention: '[Account data retention period — to be confirmed]',
  logRetention: '[Security log retention period — to be confirmed]',
  reportRetention: '[Safety report retention period — to be confirmed]',
  deletionTime: '[Deletion processing time — to be confirmed]',
  responseTime: '[Response time for requests and complaints — to be confirmed]',
};

/**
 * Region notes. These summarise points to CHECK with counsel; they are not a
 * statement that Polyglot complies with any of these laws.
 */
export const REGIONS = [
  {
    id: 'in',
    label: 'India',
    law: 'Digital Personal Data Protection Act, 2023 (DPDP Act) and related rules',
    rights: [
      'Ask for a summary of the personal data being processed and the processing activities.',
      'Ask for correction, completion, updating or erasure of personal data.',
      'Withdraw consent as easily as it was given.',
      'Use a grievance redressal contact, and escalate to the Data Protection Board of India.',
      'Nominate another person to exercise these rights in the event of death or incapacity.',
    ],
    age: 'Under the DPDP Act a child is anyone under 18, and processing a child’s data needs verifiable parental consent. An age checkbox does not satisfy this.',
    transfers: 'Personal data may be processed outside India by the providers listed in the Privacy Policy, subject to any restrictions notified by the Government of India.',
  },
  {
    id: 'eu',
    label: 'EU / EEA and United Kingdom',
    law: 'General Data Protection Regulation (GDPR) and UK GDPR',
    rights: [
      'Access your personal data and receive a copy.',
      'Rectification and erasure.',
      'Restriction of, and objection to, processing.',
      'Data portability.',
      'Withdraw consent at any time.',
      'Complain to your data protection authority.',
    ],
    age: 'The age of digital consent varies between 13 and 16 depending on the country. Below it, parental authorisation is needed.',
    transfers: 'If data leaves the EEA or UK, a lawful transfer mechanism (for example standard contractual clauses) must be in place. [Transfer mechanism — to be confirmed]',
  },
  {
    id: 'us',
    label: 'United States',
    law: 'State privacy laws (for example the CCPA/CPRA in California) and COPPA for children',
    rights: [
      'Know what personal information is collected and why.',
      'Request deletion and correction.',
      'Opt out of the sale or sharing of personal information. Polyglot does not intend to sell personal information.',
      'Not be discriminated against for using these rights.',
    ],
    age: 'COPPA restricts collecting personal information from children under 13 without verifiable parental consent.',
    transfers: 'Data may be processed in other countries by the providers listed in the Privacy Policy.',
  },
  {
    id: 'other',
    label: 'Another country',
    law: 'Your local data protection law',
    rights: [
      'You can ask what personal data Polyglot holds about you, and ask for it to be corrected or deleted.',
      'You can withdraw optional consent at any time.',
      'Local law may give you further rights. [Additional regions — to be reviewed before launch there]',
    ],
    age: 'Age and parental-consent rules differ by country and must be reviewed before Polyglot launches there.',
    transfers: 'Data may be processed in other countries by the providers listed in the Privacy Policy.',
  },
];

export const getRegion = (id) => REGIONS.find((r) => r.id === id) ?? REGIONS[0];

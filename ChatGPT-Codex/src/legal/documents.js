// Policy text for the Legal & Privacy section. Plain data so the operator can
// edit wording without touching components. Text in [square brackets] is a
// placeholder awaiting confirmation (see config.js).
//
// These are DRAFTS written for a student project. Publishing them does not
// make Polyglot legally compliant; they need review by qualified counsel.

import { OPERATOR as OP } from './config.js';

const PROTOTYPE_NOTE =
  'Current status: this version of Polyglot is a frontend prototype with no server. Your profile, settings and scheduled meetings are stored only in your own browser, the conversation in a meeting is a scripted demo, and no audio, video or text is sent to Polyglot or to any AI provider. This policy describes how the live service is intended to work once it is connected.';

export const DOCUMENTS = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'What personal data Polyglot handles, why, who processes it and the choices you have.',
    related: ['retention', 'cookies', 'ai', 'recording'],
    regional: true,
    sections: [
      { h: 'Who we are', p: [`Polyglot is a real-time multilingual video-meeting service built as a student project in India. The operator responsible for your personal data is ${OP.name}, ${OP.address}.`, PROTOTYPE_NOTE] },
      {
        h: 'Information we handle',
        list: [
          'Account information: your email address, display name and optional profile picture.',
          'Meeting information: meeting titles, times, meeting IDs, passcodes you set and who hosts a meeting.',
          'Live media: your microphone audio, camera video and any screen you choose to share, while you are in a meeting.',
          'Speech content: the words you speak, as text produced by speech recognition, and their translations.',
          'Preferences: listening language, voice style, devices, time zone, theme and consent choices.',
          'Technical information: browser type, approximate device information and security logs needed to keep accounts safe.',
        ],
      },
      {
        h: 'Why we use it',
        list: [
          'To provide meetings: connecting you to other participants and showing your name and picture.',
          'To translate: converting speech to text, translating it and generating translated speech for listeners.',
          'To keep the service safe: preventing misuse, handling reports and protecting accounts.',
          'To improve the service, only where you have agreed to optional analytics.',
        ],
        p: ['We do not sell personal data and do not use meeting content for advertising.'],
      },
      {
        h: 'Who processes your information',
        p: [
          'To translate a live conversation, your speech has to be processed by external services. These providers act on Polyglot’s instructions:',
        ],
        list: [
          `AI speech and translation: ${OP.aiProviders}`,
          `Real-time audio and video: ${OP.mediaProvider}`,
          `Hosting and database: ${OP.hostingProvider}`,
        ],
      },
      { h: 'International transfers', p: ['These providers may process information in countries other than your own. The safeguards that apply depend on where you live — choose your region below to see the notes for it.'] },
      { h: 'Recording', p: ['Polyglot does not record meetings. Meeting audio and video are not stored, and transcripts are not kept after a meeting ends. See the Recording & Consent Policy.'] },
      { h: 'How long we keep information', p: ['Retention periods for each category are set out in the Data Retention & Deletion Policy.'] },
      { h: 'Security', p: ['Polyglot is designed so that passwords, access tokens and provider keys are handled by the server and never stored in the browser. We do not claim that meetings are end-to-end encrypted. No online service can guarantee absolute security.'] },
      { h: 'Children', p: [`Polyglot’s minimum age and the process for parental consent are: ${OP.minAge}. Until that is settled, the live service must not be opened to children.`] },
      { h: 'Your choices and rights', p: ['You can view and download your information, change optional permissions, withdraw optional consent and ask for deletion from Privacy & Security in your account. The rights that apply depend on your region:'] },
      { h: 'Contact and complaints', p: [`Privacy questions: ${OP.privacyEmail}. Grievance contact: ${OP.grievanceOfficer}. You can also use the Help & Privacy Support page.`] },
      { h: 'Changes', p: ['When this policy changes in a meaningful way we will update the date above and ask you to review it again.'] },
    ],
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    summary: 'The agreement between you and the operator of Polyglot.',
    related: ['acceptable-use', 'community', 'privacy', 'ai'],
    sections: [
      { h: 'About these terms', p: [`These terms govern your use of Polyglot, operated by ${OP.name}. By creating an account or joining a meeting you agree to them. If you do not agree, do not use the service.`, PROTOTYPE_NOTE] },
      { h: 'Eligibility', p: [`You must meet the minimum age for your country to use Polyglot: ${OP.minAge}. If you use Polyglot on behalf of an organisation, you confirm you are allowed to accept these terms for it.`] },
      { h: 'Your account', p: ['Keep your sign-in details private and tell us if you think someone else has used your account. You are responsible for activity on your account.'] },
      { h: 'The service', p: ['Polyglot provides video meetings with AI translation. Translation and generated speech are produced automatically and may be wrong, incomplete or delayed. Polyglot is not a certified interpreting service and is not an emergency communication service. Do not rely on it for medical, legal, financial or safety-critical communication without independent verification.'] },
      { h: 'Your content', p: ['You keep the rights to what you say, show and share. You give Polyglot permission to process it only as needed to run the meeting and translate it for the other participants.'] },
      { h: 'Acceptable use', p: ['You must follow the Acceptable Use Policy and Community Guidelines. Hosts may mute or remove participants, lock a meeting and end it.'] },
      { h: 'Recording', p: ['Polyglot does not offer recording. You must not record other participants with other tools without the consent that the law in your and their location requires.'] },
      { h: 'Suspension and ending', p: ['You can stop using Polyglot and ask for your account to be deleted at any time. We may suspend or close accounts that break these terms or put others at risk.'] },
      { h: 'Disclaimers and liability', p: ['Polyglot is provided as is, as a student project, without guarantees of availability or accuracy. [Limitation of liability wording — to be drafted by legal counsel]. Nothing in these terms removes rights that the law does not allow to be removed.'] },
      { h: 'Governing law', p: [OP.governingLaw] },
      { h: 'Contact', p: [`Questions about these terms: ${OP.supportEmail}.`] },
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use Policy',
    summary: 'What you may not do with Polyglot.',
    related: ['community', 'terms'],
    sections: [
      { h: 'Purpose', p: ['Polyglot exists so people who speak different languages can talk to each other. This policy lists uses that are not allowed.'] },
      {
        h: 'You must not',
        list: [
          'Break the law, or help anyone else to.',
          'Harass, threaten, bully or sexually exploit anyone, or share content that sexualises minors.',
          'Share hateful content or incite violence against people because of who they are.',
          'Impersonate another person or misrepresent who you are in a way that deceives or harms.',
          'Record, capture or publish other participants without the consent the law requires.',
          'Use translated or generated speech to deceive people about who said something, or to commit fraud.',
          'Share malware, attempt to access accounts or meetings you are not invited to, or disrupt the service.',
          'Scrape, resell or build a competing dataset from the service.',
          'Use Polyglot for emergency calls or as the only channel for safety-critical instructions.',
        ],
      },
      { h: 'Enforcement', p: ['Hosts can remove participants and lock meetings. Reports are reviewed by the operator, who may warn, suspend or close accounts and, where the law requires, tell the authorities.'] },
      { h: 'Reporting', p: [`Report misuse from the People list in a meeting, from the Help & Privacy Support page, or to ${OP.abuseEmail}.`] },
    ],
  },
  {
    id: 'cookies',
    title: 'Cookie Policy',
    summary: 'What Polyglot stores in your browser and the choices you have.',
    related: ['privacy'],
    sections: [
      { h: 'What this covers', p: ['Cookies and similar technologies such as browser local storage, which let a site remember things on your device.'] },
      {
        h: 'Essential storage',
        p: ['Needed for Polyglot to work. It cannot be switched off, and rejecting optional cookies never blocks it:'],
        list: [
          'Remembering that you are signed in.',
          'Your profile, settings and device choices.',
          'Meetings you scheduled (in this prototype these live only in your browser).',
          'Your consent and cookie choices, so we do not ask again on every visit.',
        ],
      },
      { h: 'Analytics', p: ['Optional and off unless you allow it. No analytics tool is installed in Polyglot today. If one is added it will load only after you have agreed, and it will be named here. [Analytics provider — none at present]'] },
      { h: 'Advertising', p: ['Polyglot does not use advertising cookies. If that ever changes, they will be a separate choice that is off by default.'] },
      { h: 'Changing your choice', p: ['Use “Cookie choices” in the footer, or Privacy & Security in your account, at any time. You can also clear site data in your browser, which signs you out and removes locally stored settings.'] },
    ],
  },
  {
    id: 'ai',
    title: 'AI Transparency Notice',
    summary: 'When and how artificial intelligence processes what you say.',
    related: ['privacy', 'recording', 'terms'],
    sections: [
      { h: 'In short', p: ['POLYGLOT uses artificial intelligence to translate conversations in real time. Translations and generated speech may contain inaccuracies. Users should independently verify important information. POLYGLOT is not a certified interpreting service or emergency communication service.'] },
      {
        h: 'What the AI does',
        list: [
          'Speech-to-text: your speech is converted into text and the language you are speaking is detected automatically.',
          'Translation: that text is translated into each listener’s chosen language.',
          'AI-generated speech: the translation is spoken by a synthetic voice.',
        ],
      },
      { h: 'The voice you hear is generated', p: ['Translated audio is produced by a text-to-speech system. It is not the original speaker’s own voice, and it is not an unmodified recording of them. Optional themed voices only change how the synthetic voice sounds to you. Polyglot does not clone real people’s voices.'] },
      { h: 'Who provides the AI', p: [`Speech recognition, translation and speech generation are provided by third parties: ${OP.aiProviders}. Audio and text are sent to them only to perform these steps. [Whether providers may use data to train their models — to be confirmed from provider contracts]`] },
      { h: 'Limits you should know about', list: ['Names, numbers, technical terms, humour and mixed-language speech are more likely to be translated wrongly.', 'Translations can lag behind the speaker.', 'Not every language pair has been verified, and some languages may be captions-only on some devices.', 'Tone and emphasis may not carry over.'] },
      { h: 'How you can tell AI is active', p: ['During a meeting the top bar shows whether AI translation is on, and each translated caption shows the original text beneath it. You can switch to original audio at any time.'] },
      { h: 'Browser permission is not AI consent', p: ['Allowing your microphone or camera in the browser only lets Polyglot use the device. Agreement to AI processing is asked for separately when you create your account.'] },
      { h: 'Current prototype', p: [PROTOTYPE_NOTE] },
    ],
  },
  {
    id: 'community',
    title: 'Community Guidelines',
    summary: 'How we expect people to treat each other in meetings.',
    related: ['acceptable-use', 'terms'],
    sections: [
      { h: 'Be respectful', p: ['You are talking with people from other cultures and languages. Speak as you would in person, and assume good intent — a clumsy sentence may be the translation, not the speaker.'] },
      { h: 'Make translation easier', list: ['Speak clearly and one at a time.', 'Avoid slang that will not translate.', 'Check understanding of anything important, such as dates, amounts and names.'] },
      { h: 'Respect privacy', list: ['Do not record or screenshot people without their agreement.', 'Share only screens and documents you are allowed to share.', 'Do not share other people’s personal details.'] },
      { h: 'Hosts', p: ['Hosts are responsible for their meetings. Use lock, mute and remove when needed, and report serious problems.'] },
      { h: 'If something goes wrong', p: ['Leave the meeting if you feel unsafe. Use Report in the People list or the Help & Privacy Support page. Polyglot cannot contact emergency services for you — call your local emergency number.'] },
    ],
  },
  {
    id: 'recording',
    title: 'Recording & Consent Policy',
    summary: 'Polyglot does not record meetings. This explains what that means.',
    related: ['privacy', 'retention', 'ai'],
    sections: [
      { h: 'Recording is switched off', p: ['Polyglot has no recording feature. There is no record button, meeting audio and video are not stored, and transcripts are not kept by default: the live transcript exists only on your screen during the meeting and is discarded when you leave.'] },
      { h: 'Live processing is not recording', p: ['To translate, your speech is processed as it happens by the AI providers named in the Privacy Policy. It is used to produce the translation and is not kept by Polyglot as a recording. [Provider retention of audio and text — to be confirmed from provider contracts]'] },
      { h: 'Microphone, camera and screen sharing', list: ['Your browser asks for permission before Polyglot can use your microphone or camera.', 'You can mute or turn off your camera instantly, and the meeting always shows their state.', 'Screen sharing starts only when you choose it and pick what to share. A banner with a Stop sharing button stays visible while it is active.'] },
      { h: 'Recording by other people', p: ['Polyglot cannot stop someone capturing their own screen with other software. Doing so without the consent required by law is against the Acceptable Use Policy.'] },
      { h: 'If recording is ever added', p: ['It would be a separate feature that stays off until all of the following exist:'], list: ['Advance notice to every participant.', 'Appropriate consent from every participant, with the option to leave instead.', 'A recording indicator visible to everyone for the whole time.', 'A stop control.', 'Restricted access to recordings.', 'Retention settings and deletion on request.'] },
      { h: 'No hidden recording', p: ['Polyglot will never record a meeting silently.'] },
    ],
  },
  {
    id: 'retention',
    title: 'Data Retention & Deletion Policy',
    summary: 'What is kept, for how long, and how to have it deleted.',
    related: ['privacy', 'recording'],
    sections: [
      { h: 'Principle', p: ['Polyglot keeps personal data only as long as it is needed for the purpose it was collected for.', PROTOTYPE_NOTE] },
      {
        h: 'Retention by category',
        table: {
          head: ['Information', 'Why it is kept', 'How long'],
          rows: [
            ['Account (email, name, picture)', 'To provide your account', `Until you delete your account. ${OP.accountRetention}`],
            ['Scheduled meetings', 'To show and run your meetings', 'Until you delete them or your account'],
            ['Meeting audio and video', 'Live delivery only', 'Not stored'],
            ['Speech text and translations', 'Live translation only', 'Not kept after the meeting'],
            ['Preferences and consent records', 'To respect your choices and show when consent was given', 'For the life of the account; consent records as long as needed to demonstrate consent'],
            ['Security logs', 'To protect accounts', OP.logRetention],
            ['Safety reports', 'To investigate misuse', OP.reportRetention],
          ],
        },
      },
      { h: 'Third parties', p: [`Providers that may process information: ${OP.aiProviders}; ${OP.mediaProvider}; ${OP.hostingProvider}. Their own retention must match this policy. [Provider retention terms — to be confirmed]`] },
      { h: 'How to request deletion or a copy', p: ['Go to Privacy & Security in your account to download your data, ask for specific data to be deleted, or ask for your whole account to be deleted. You can also use the Help & Privacy Support page.'] },
      { h: 'What happens after a deletion request', p: [`Requests are confirmed only once the server has completed them. Expected processing time: ${OP.deletionTime}. Some information may have to be kept where the law requires it, and you will be told if so.`] },
      { h: 'Data in your browser', p: ['Information stored in your own browser can be erased immediately from Privacy & Security, or by clearing site data in your browser settings.'] },
    ],
  },
  {
    id: 'about',
    title: 'About POLYGLOT',
    summary: 'Speak your language. Hear theirs.',
    related: ['ai', 'privacy'],
    notLegal: true,
    sections: [
      { h: 'What it is', p: ['Polyglot is a video-meeting app where everyone speaks their own language and hears everyone else in theirs. It was created by a student team for the Veritas AI International High School Hackathon 2026.'] },
      { h: 'Where it stands', p: [PROTOTYPE_NOTE] },
      { h: 'Who runs it', p: [`Operator: ${OP.name}. Contact: ${OP.supportEmail}.`] },
    ],
  },
];

export const LEGAL_DOCS = DOCUMENTS.filter((d) => !d.notLegal);
export const getDocument = (id) => DOCUMENTS.find((d) => d.id === id);

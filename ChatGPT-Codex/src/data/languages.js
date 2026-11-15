// Polyglot's initial 20-language catalogue (from the project proposal).
// `tts` is the BCP-47 tag used for voice selection during playback.
export const LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', tts: 'hi-IN' },
  { code: 'en', name: 'English', native: 'English', tts: 'en-US' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', tts: 'bn-IN' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', tts: 'ta-IN' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', tts: 'te-IN' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', tts: 'mr-IN' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', tts: 'kn-IN' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', tts: 'ml-IN' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', tts: 'gu-IN' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', tts: 'pa-IN' },
  { code: 'ur', name: 'Urdu', native: 'اردو', tts: 'ur-PK' },
  { code: 'es', name: 'Spanish', native: 'Español', tts: 'es-ES' },
  { code: 'fr', name: 'French', native: 'Français', tts: 'fr-FR' },
  { code: 'de', name: 'German', native: 'Deutsch', tts: 'de-DE' },
  { code: 'ar', name: 'Arabic', native: 'العربية', tts: 'ar-SA' },
  { code: 'zh', name: 'Chinese', native: '中文', tts: 'zh-CN' },
  { code: 'ja', name: 'Japanese', native: '日本語', tts: 'ja-JP' },
  { code: 'pt', name: 'Portuguese', native: 'Português', tts: 'pt-BR' },
  { code: 'it', name: 'Italian', native: 'Italiano', tts: 'it-IT' },
  { code: 'ko', name: 'Korean', native: '한국어', tts: 'ko-KR' },
];

const BY_CODE = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

export const getLanguage = (code) => BY_CODE[code] ?? BY_CODE.en;

// Tested scope from CONTRACT.md; evaluation scores are loaded separately.
export const TESTED_LANGUAGE_CODES = ['hi', 'en', 'ta', 'bn'];
export const isTestedLanguage = (code) => TESTED_LANGUAGE_CODES.includes(code);

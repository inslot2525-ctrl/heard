// Languages. Generated from Nexconn's "Supported languages and codes" (docs.nexconn.ai/chatsdk-web/
// builtin-translation/supported-languages-and-codes), Oct 31 2026: 211 languages.
// Excluded: Traditional Chinese (zh-tw), Mongolian (mn), Cantonese (yue). Nexconn translates those only
// to and from Chinese, so an English-speaking mentor couldn't read them.
//
// Two different things:
// - CHAT language: any code here. Messages are translated per reader, so chat works in all of them.
// - UI language: the app's own text. Fully written for UI_LANGS; others fall back to English.

export const UI_LANGS = ['en', 'hi', 'mr', 'zh'] as const;
export type UiLang = (typeof UI_LANGS)[number];

/** Shown first in pickers, with their own names. Indian languages first: Heard is for Indian campuses. */
export const FEATURED: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'mr', name: 'मराठी' },
  { code: 'zh', name: '中文' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'മലയാളം' },
  { code: 'gu', name: 'ગુજરાતી' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'اردو' },
  { code: 'or', name: 'ଓଡ଼ିଆ' },
  { code: 'as', name: 'অসমীয়া' },
  { code: 'ne', name: 'नेपाली' },
  { code: 'si', name: 'සිංහල' },
  { code: 'ar', name: 'العربية' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'it', name: 'Italiano' },
  { code: 'sw', name: 'Kiswahili' },
];

/** Every chat language Nexconn can translate between: [code, English name]. */
export const ALL_LANGUAGES: [string, string][] = [
  ['ab', 'Abkhazian'],
  ['sq', 'Albanian'],
  ['ak', 'Akan'],
  ['ar', 'Arabic'],
  ['an', 'Aragonese'],
  ['am', 'Amharic'],
  ['as', 'Assamese'],
  ['az', 'Azerbaijani'],
  ['ast', 'Asturian'],
  ['nch', 'Central Huasteca Nahuatl'],
  ['ee', 'Ewe'],
  ['ay', 'Aymara'],
  ['ga', 'Irish'],
  ['et', 'Estonian'],
  ['oj', 'Ojibwa'],
  ['oc', 'Occitan'],
  ['or', 'Oriya'],
  ['om', 'Oromo'],
  ['os', 'Ossetian'],
  ['tpi', 'Tok Pisin'],
  ['ba', 'Bashkir'],
  ['eu', 'Basque'],
  ['be', 'Belarusian'],
  ['ber', 'Berber languages'],
  ['bm', 'Bambara'],
  ['pag', 'Pangasinan'],
  ['bg', 'Bulgarian'],
  ['se', 'Northern Sami'],
  ['bem', 'Bemba (Zambia)'],
  ['byn', 'Blin'],
  ['bi', 'Bislama'],
  ['bal', 'Baluchi'],
  ['is', 'Icelandic'],
  ['pl', 'Polish'],
  ['bs', 'Bosnian'],
  ['fa', 'Persian'],
  ['bho', 'Bhojpuri'],
  ['br', 'Breton'],
  ['ch', 'Chamorro'],
  ['cbk', 'Chavacano'],
  ['cv', 'Chuvash'],
  ['ts', 'Tsonga'],
  ['tt', 'Tatar'],
  ['da', 'Danish'],
  ['shn', 'Shan'],
  ['tet', 'Tetum'],
  ['de', 'German'],
  ['nds', 'Low German'],
  ['sco', 'Scots'],
  ['dv', 'Dhivehi'],
  ['kdx', 'Kam'],
  ['dtp', 'Kadazan Dusun'],
  ['ru', 'Russian'],
  ['fo', 'Faroese'],
  ['fr', 'French'],
  ['sa', 'Sanskrit'],
  ['fil', 'Filipino'],
  ['fj', 'Fijian'],
  ['fi', 'Finnish'],
  ['fur', 'Friulian'],
  ['fvr', 'Fur'],
  ['kg', 'Kongo'],
  ['km', 'Khmer'],
  ['ngu', 'Guerrero Nahuatl'],
  ['kl', 'Kalaallisut'],
  ['ka', 'Georgian'],
  ['gos', 'Gronings'],
  ['gu', 'Gujarati'],
  ['gn', 'Guarani'],
  ['kk', 'Kazakh'],
  ['ht', 'Haitian'],
  ['ko', 'Korean'],
  ['ha', 'Hausa'],
  ['nl', 'Dutch'],
  ['cnr', 'Montenegrin'],
  ['hup', 'Hupa'],
  ['gil', 'Gilbertese'],
  ['rn', 'Rundi'],
  ['quc', 'K&#x27;iche&#x27;'],
  ['ky', 'Kirghiz'],
  ['gl', 'Galician'],
  ['ca', 'Catalan'],
  ['cs', 'Czech'],
  ['kab', 'Kabyle'],
  ['kn', 'Kannada'],
  ['kr', 'Kanuri'],
  ['csb', 'Kashubian'],
  ['kha', 'Khasi'],
  ['kw', 'Cornish'],
  ['xh', 'Xhosa'],
  ['co', 'Corsican'],
  ['mus', 'Creek'],
  ['crh', 'Crimean Tatar'],
  ['tlh', 'Klingon'],
  ['hbs', 'Serbo-Croatian'],
  ['qu', 'Quechua'],
  ['ks', 'Kashmiri'],
  ['ku', 'Kurdish'],
  ['la', 'Latin'],
  ['ltg', 'Latgalian'],
  ['lv', 'Latvian'],
  ['lo', 'Lao'],
  ['lt', 'Lithuanian'],
  ['li', 'Limburgish'],
  ['ln', 'Lingala'],
  ['lg', 'Ganda'],
  ['lb', 'Letzeburgesch'],
  ['rue', 'Rusyn'],
  ['rw', 'Kinyarwanda'],
  ['ro', 'Romanian'],
  ['rm', 'Romansh'],
  ['rom', 'Romany'],
  ['jbo', 'Lojban'],
  ['mg', 'Malagasy'],
  ['gv', 'Manx'],
  ['mt', 'Maltese'],
  ['mr', 'Marathi'],
  ['ml', 'Malayalam'],
  ['ms', 'Malay'],
  ['chm', 'Mari (Russia)'],
  ['mk', 'Macedonian'],
  ['mh', 'Marshallese'],
  ['kek', 'Kekchí'],
  ['mai', 'Maithili'],
  ['mfe', 'Morisyen'],
  ['mi', 'Maori'],
  ['bn', 'Bengali'],
  ['my', 'Burmese'],
  ['hmn', 'Hmong'],
  ['umb', 'Umbundu'],
  ['nv', 'Navajo'],
  ['af', 'Afrikaans'],
  ['ne', 'Nepali'],
  ['niu', 'Niuean'],
  ['no', 'Norwegian'],
  ['pmn', 'Pam'],
  ['pap', 'Papiamento'],
  ['pa', 'Panjabi'],
  ['pt', 'Portuguese'],
  ['ps', 'Pushto'],
  ['ny', 'Nyanja'],
  ['tw', 'Twi'],
  ['chr', 'Cherokee'],
  ['ja', 'Japanese'],
  ['sv', 'Swedish'],
  ['sm', 'Samoan'],
  ['sg', 'Sango'],
  ['si', 'Sinhala'],
  ['hsb', 'Upper Sorbian'],
  ['eo', 'Esperanto'],
  ['sl', 'Slovenian'],
  ['sw', 'Swahili'],
  ['so', 'Somali'],
  ['sk', 'Slovak'],
  ['tl', 'Tagalog'],
  ['tg', 'Tajik'],
  ['ty', 'Tahitian'],
  ['te', 'Telugu'],
  ['ta', 'Tamil'],
  ['th', 'Thai'],
  ['to', 'Tonga (Tonga Islands)'],
  ['toi', 'Tonga (Zambia)'],
  ['ti', 'Tigrinya'],
  ['tvl', 'Tuvalu'],
  ['tyv', 'Tuvinian'],
  ['tr', 'Turkish'],
  ['tk', 'Turkmen'],
  ['wa', 'Walloon'],
  ['war', 'Waray (Philippines)'],
  ['cy', 'Welsh'],
  ['ve', 'Venda'],
  ['vo', 'Volapük'],
  ['wo', 'Wolof'],
  ['udm', 'Udmurt'],
  ['ur', 'Urdu'],
  ['uz', 'Uzbek'],
  ['es', 'Spanish'],
  ['ie', 'Interlingue'],
  ['fy', 'Western Frisian'],
  ['szl', 'Silesian'],
  ['he', 'Hebrew'],
  ['hil', 'Hiligaynon'],
  ['haw', 'Hawaiian'],
  ['el', 'Modern Greek'],
  ['lfn', 'Lingua Franca Nova'],
  ['sd', 'Sindhi'],
  ['hu', 'Hungarian'],
  ['sn', 'Shona'],
  ['ceb', 'Cebuano'],
  ['syr', 'Syriac'],
  ['su', 'Sundanese'],
  ['hy', 'Armenian'],
  ['ace', 'Achinese'],
  ['iba', 'Iban'],
  ['ig', 'Igbo'],
  ['io', 'Ido'],
  ['ilo', 'Iloko'],
  ['iu', 'Inuktitut'],
  ['it', 'Italian'],
  ['yi', 'Yiddish'],
  ['ia', 'Interlingua'],
  ['hi', 'Hindi'],
  ['id', 'Indonesia'],
  ['inh', 'Ingush'],
  ['en', 'English'],
  ['yo', 'Yoruba'],
  ['vi', 'Vietnamese'],
  ['zza', 'Zaza'],
  ['jv', 'Javanese'],
  ['zh', 'Chinese'],
  ['zu', 'Zulu'],
];

const CODES = new Set(ALL_LANGUAGES.map(([c]) => c));

export function isLanguage(code: unknown): code is string {
  return typeof code === 'string' && CODES.has(code);
}

export function isUiLang(code: string): code is UiLang {
  return (UI_LANGS as readonly string[]).includes(code);
}

/** The UI language to render for a chat language (falls back to English). */
export function uiLangFor(code: string): UiLang {
  return isUiLang(code) ? code : 'en';
}

/** English name, e.g. 'Marathi' (for prompts and logs). */
export function englishLanguageName(code: string): string {
  return ALL_LANGUAGES.find(([c]) => c === code)?.[1] ?? code;
}

export function languageName(code: string): string {
  return FEATURED.find((l) => l.code === code)?.name ?? ALL_LANGUAGES.find(([c]) => c === code)?.[1] ?? code;
}

/**
 * Languages we translate with Gemini instead of Nexconn. In testing Nexconn garbled Marathi twice
 * ("ratrilogy"), so Indian languages go through Gemini; other pairs (e.g. zh ↔ en, which Nexconn does
 * very well) stay on Nexconn. See docs/SPIKES.md C.
 */
export const LLM_TRANSLATED = new Set(['hi', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'gu', 'pa', 'ur', 'or', 'as', 'ne', 'si']);

/**
 * Gemini when either side is an Indian language, judged by the chosen languages AND by the script the
 * text is actually written in (a Marathi message from someone who picked English must still go through
 * Gemini: Nexconn turned a safety-relevant Marathi sentence into nonsense).
 */
export function useLlmTranslation(from: string | undefined, to: string, text?: string) {
  if (LLM_TRANSLATED.has(to) || (from !== undefined && LLM_TRANSLATED.has(from))) return true;
  const s = text ? scriptOf(text) : null;
  return s !== null && INDIC_SCRIPTS.has(s);
}

const INDIC_SCRIPTS = new Set<string>(['devanagari', 'bengali', 'gurmukhi', 'gujarati', 'oriya', 'tamil', 'telugu', 'kannada', 'malayalam']);

// ---- script detection (for auto-translate) -------------------------------------------------------
// People often write in a different language than the one they picked (a Marathi speaker who chose
// English for the UI). So besides comparing chosen languages, we compare the message's script with the
// script the reader's language uses. Different scripts → translate.

export type Script = 'latin' | 'devanagari' | 'han' | 'arabic' | 'bengali' | 'tamil' | 'telugu' | 'kannada' | 'malayalam' | 'gujarati' | 'gurmukhi' | 'oriya' | 'other';

const SCRIPT_RANGES: [Script, RegExp][] = [
  ['devanagari', /[ऀ-ॿ]/g],
  ['bengali', /[ঀ-৿]/g],
  ['gurmukhi', /[਀-੿]/g],
  ['gujarati', /[઀-૿]/g],
  ['oriya', /[଀-୿]/g],
  ['tamil', /[஀-௿]/g],
  ['telugu', /[ఀ-౿]/g],
  ['kannada', /[ಀ-೿]/g],
  ['malayalam', /[ഀ-ൿ]/g],
  ['arabic', /[؀-ۿ]/g],
  ['han', /[一-鿿㐀-䶿]/g],
  ['latin', /[A-Za-zÀ-ɏ]/g],
];

/** The script most of the message's letters are in, or null for no letters (emoji, numbers). */
export function scriptOf(text: string): Script | null {
  let best: Script | null = null;
  let max = 0;
  for (const [script, re] of SCRIPT_RANGES) {
    const n = text.match(re)?.length ?? 0;
    if (n > max) [best, max] = [script, n];
  }
  return best;
}

const LANG_SCRIPT: Record<string, Script> = {
  hi: 'devanagari', mr: 'devanagari', ne: 'devanagari', sa: 'devanagari', bn: 'bengali', as: 'bengali', pa: 'gurmukhi',
  gu: 'gujarati', or: 'oriya', ta: 'tamil', te: 'telugu', kn: 'kannada', ml: 'malayalam', ur: 'arabic', ar: 'arabic',
  fa: 'arabic', zh: 'han', ja: 'han',
};

/** Script a language is normally written in; anything unlisted is treated as Latin. */
export function scriptForLanguage(lang: string): Script {
  return LANG_SCRIPT[lang] ?? 'latin';
}

/**
 * Should a received message be auto-translated for this reader? Yes if the sender chose another
 * language, or if the message is visibly in another script than the reader's language uses.
 */
export function needsTranslation(text: string, readerLang: string, senderLang?: string) {
  if (!text.trim()) return false;
  if (senderLang && senderLang !== readerLang) return true;
  const s = scriptOf(text);
  return s !== null && s !== scriptForLanguage(readerLang);
}

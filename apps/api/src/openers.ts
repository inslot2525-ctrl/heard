// Draft opening lines for mentors, by rule and in the mentor's language. A mentor always edits
// and sends; nothing here reaches a student on its own. Template drafts now; an LLM draft can
// replace them later, but must pass checkOpener() too.
// Hindi and Marathi use respectful, gender-neutral forms (आप / तुम्ही). Get a native speaker to
// review before the pilot.

import { uiLangFor, type PulseArea, type UiLang } from '@heard/shared';

const AREA: Record<UiLang, Record<PulseArea, string>> = {
  en: { studies: 'studies', money: 'money', health: 'health', home: 'things at home' },
  hi: { studies: 'पढ़ाई', money: 'पैसों', health: 'सेहत', home: 'घर-परिवार' },
  mr: { studies: 'अभ्यास', money: 'पैसे', health: 'आरोग्य', home: 'घर-कुटुंब' },
  zh: { studies: '学业', money: '经济方面', health: '身体', home: '家里的事' },
};

type Template = (first: string, area: string) => string;

const TEMPLATES: Record<UiLang, Record<'struggling' | 'silent' | 'wants_to_talk', Template>> = {
  en: {
    struggling: (n, a) => `Hi ${n}, thanks for doing your weekly check-ins. It looks like ${a} has been hard lately. Could we talk for a few minutes this week? You can just reply here.`,
    silent: (n) => `Hi ${n}, I haven't seen your check-in for a couple of weeks. Just checking that you're doing okay. Reply here whenever you can.`,
    wants_to_talk: (n) => `Hi ${n}, you asked to talk, and I'm glad you did. What time suits you this week? You can reply here.`,
  },
  hi: {
    struggling: (n, a) => `नमस्ते ${n}, हर हफ़्ते चेक-इन करने के लिए धन्यवाद। लगता है पिछले कुछ समय से ${a} को लेकर मुश्किल हो रही है। क्या इस हफ़्ते कुछ मिनट बात कर सकते हैं? आप यहीं जवाब दे सकते हैं।`,
    silent: (n) => `नमस्ते ${n}, पिछले दो हफ़्तों से आपका चेक-इन नहीं दिखा। बस यह जानना था कि सब ठीक है। जब समय मिले, यहीं जवाब दीजिए।`,
    wants_to_talk: (n) => `नमस्ते ${n}, आपने बात करने के लिए कहा, यह बहुत अच्छा किया। इस हफ़्ते कौन-सा समय ठीक रहेगा? यहीं जवाब दीजिए।`,
  },
  mr: {
    struggling: (n, a) => `नमस्कार ${n}, दर आठवड्याला चेक-इन केल्याबद्दल धन्यवाद. गेल्या काही दिवसांपासून ${a} बाबत अडचण येत आहे असे दिसते. या आठवड्यात थोडा वेळ बोलूया का? इथेच उत्तर द्या.`,
    silent: (n) => `नमस्कार ${n}, गेल्या दोन आठवड्यांपासून तुमचे चेक-इन दिसले नाही. सगळे ठीक आहे ना, एवढेच विचारायचे होते. वेळ मिळेल तेव्हा इथे उत्तर द्या.`,
    wants_to_talk: (n) => `नमस्कार ${n}, तुम्ही बोलायचे आहे असे सांगितले, हे छान केलेत. या आठवड्यात कोणती वेळ सोयीची आहे? इथेच उत्तर द्या.`,
  },
  zh: {
    struggling: (n, a) => `${n}你好，谢谢你每周按时签到。看起来最近${a}有些困难。这周我们能聊几分钟吗？直接在这里回复就可以。`,
    silent: (n) => `${n}你好，已经两周没看到你的签到了，想问问你一切都还好吗？方便的时候在这里回复我就行。`,
    wants_to_talk: (n) => `${n}你好，你说想聊一聊，很高兴你提出来。这周什么时间方便？直接在这里回复就可以。`,
  },
};


// Register flags (monthly hostel records): name what the record shows, ask how it looks from their side.
const METRIC_NAME: Record<UiLang, Record<string, string>> = {
  en: { attendance: 'class attendance', academics: 'test marks', duties: 'hostel duties', activities: 'activities', conduct: 'things in the hostel' },
  hi: { attendance: 'क्लास की हाज़िरी', academics: 'टेस्ट के अंक', duties: 'हॉस्टल की ड्यूटी', activities: 'गतिविधियाँ', conduct: 'हॉस्टल की बातें' },
  mr: { attendance: 'वर्गातील हजेरी', academics: 'चाचणीचे गुण', duties: 'हॉस्टेलची कामे', activities: 'उपक्रम', conduct: 'हॉस्टेलमधील गोष्टी' },
  zh: { attendance: '上课出勤', academics: '测验成绩', duties: '宿舍值日', activities: '课外活动', conduct: '宿舍里的事情' },
};

const REGISTER: Record<UiLang, Template> = {
  en: (n, m) => `Hi ${n}, I was looking at this month's hostel record and noticed a change in ${m}. How are things from your side? Could we talk for a few minutes this week? You can reply here.`,
  hi: (n, m) => `नमस्ते ${n}, इस महीने के हॉस्टल रिकॉर्ड में ${m} में कुछ बदलाव दिखा। आपकी तरफ़ से सब कैसा चल रहा है? क्या इस हफ़्ते कुछ मिनट बात कर सकते हैं? आप यहीं जवाब दे सकते हैं।`,
  mr: (n, m) => `नमस्कार ${n}, या महिन्याच्या हॉस्टेल रेकॉर्डमध्ये ${m} यात थोडा बदल दिसला. तुमच्या बाजूने सगळे कसे चालले आहे? या आठवड्यात थोडा वेळ बोलूया का? इथेच उत्तर द्या.`,
  zh: (n, m) => `${n}你好，我看了这个月的宿舍记录，注意到${m}有些变化。你那边情况怎么样？这周我们能聊几分钟吗？直接在这里回复就可以。`,
};

/** Drafts in the mentor's language when we have templates for it; otherwise English. */
export function draftOpener(rule: string, area: PulseArea | string | null, studentName: string, mentorLang: string) {
  const lang = uiLangFor(mentorLang);
  const first = studentName.trim().split(/\s+/)[0] || studentName;
  const t = TEMPLATES[lang];
  if (rule === 'silent') return t.silent(first, '');
  if (rule === 'wants_to_talk') return t.wants_to_talk(first, '');
  if (rule.startsWith('register_') || rule === 'conduct_concern') return REGISTER[lang](first, METRIC_NAME[lang][area ?? ''] ?? METRIC_NAME[lang].attendance);
  return t.struggling(first, area ? (AREA[lang][area as PulseArea] ?? AREA[lang].studies) : AREA[lang].studies);
}

// Words a draft or a sent opener must not contain: labels, diagnoses, scores, threats.
const BANNED = [
  /\b(depress(ed|ion)?|anxiety|disorder|mental(ly)? ill|suicid\w*|at[- ]risk|risk score|diagnos\w*|expel\w*|rusticat\w*)\b/i,
  /(डिप्रेशन|अवसाद|मानसिक रोग|आत्महत्या|निलंबन)/,
  /(抑郁|焦虑症|精神病|自杀|高风险|开除)/,
];

export const OPENER_MAX = 1000;

/** null = fine; otherwise the reason the text can't be sent. */
export function checkOpener(text: string): string | null {
  const t = text.trim();
  if (!t) return 'empty';
  if (t.length > OPENER_MAX) return 'too_long';
  if (BANNED.some((re) => re.test(t))) return 'labels_or_diagnosis';
  return null;
}

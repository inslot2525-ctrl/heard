// Quick buttons for languages with a full UI (English, Hindi, Marathi, Chinese), plus a menu of every
// chat language Nexconn can translate (211). Other languages: UI in English, chat translated.
import { ALL_LANGUAGES, FEATURED, isUiLang } from '@heard/shared';
import { QUICK_LANGS, strings } from './i18n';

export function LanguagePicker({ value, onChange }: { value: string; onChange: (lang: string) => void }) {
  const t = strings(value);
  const quick = QUICK_LANGS.map((l) => l.code as string);
  const featuredRest = FEATURED.filter((l) => !quick.includes(l.code));
  const featuredCodes = new Set(FEATURED.map((l) => l.code));
  const others = ALL_LANGUAGES.filter(([c]) => !featuredCodes.has(c)).sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <div>
      <div className="seg" role="group" aria-label={t.language}>
        {QUICK_LANGS.map((l) => (
          <button key={l.code} type="button" aria-pressed={value === l.code} onClick={() => onChange(l.code)}>
            {l.name}
          </button>
        ))}
      </div>
      <select
        aria-label={t.moreLanguages}
        style={{ marginTop: '0.4rem' }}
        value={quick.includes(value) ? '' : value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      >
        <option value="">{t.moreLanguages}…</option>
        <optgroup label="★">
          {featuredRest.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </optgroup>
        <optgroup label="A–Z">
          {others.map(([c, n]) => (
            <option key={c} value={c}>{n}</option>
          ))}
        </optgroup>
      </select>
      {!isUiLang(value) && <p className="small muted" style={{ margin: '0.4rem 0 0' }}>{t.chatLanguageNote}</p>}
    </div>
  );
}

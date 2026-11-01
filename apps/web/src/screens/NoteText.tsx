// A student's note, with a translation into the reader's language when it's in another language or
// script. The original always stays visible (machine translation can drop a key word).
import { useEffect, useState } from 'react';
import { needsTranslation } from '@heard/shared';
import { api } from '../api';
import { useT, type Strings } from '../i18n';

function key(text: string, lang: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `heard.note.${lang}.${h}.${text.length}`;
}

export function NoteText({ text, lang }: { text: string; lang: string }) {
  const t = useT();
  const [tr, setTr] = useState<string | null>(() => localStorage.getItem(key(text, lang)));
  useEffect(() => {
    if (tr !== null || !needsTranslation(text, lang)) return;
    api<{ text: string }>('/translate', { body: { text, to: lang } })
      .then((r) => {
        localStorage.setItem(key(text, lang), r.text);
        setTr(r.text);
      })
      .catch(() => undefined);
  }, [text, lang, tr]);
  return (
    <>
      <div className="quote">{text}</div>
      {tr && tr.trim() !== text.trim() && (
        <div className="translation small">
          <span className="label">{t.translatedFrom}</span> {tr}
        </div>
      )}
    </>
  );
}

export function themeLabel(t: Strings, theme: string) {
  return (t[`theme_${theme}` as keyof Strings] as string | undefined) ?? theme;
}

export function ThemeChips({ themes }: { themes: string[] }) {
  const t = useT();
  if (!themes?.length) return null;
  return (
    <span className="themes">
      {themes.map((th) => (
        <span key={th} className="theme-chip">
          {themeLabel(t, th)}
        </span>
      ))}
    </span>
  );
}

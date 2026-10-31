import { useState } from 'react';
import { languageName } from '@heard/shared';
import { useMe } from '../App';
import { api } from '../api';
import { LanguagePicker } from '../LanguagePicker';
import { useT } from '../i18n';

/** Header button showing my language; opens the picker and saves to the server. */
export function LanguageSwitch() {
  const t = useT();
  const { me, refresh } = useMe();
  const [open, setOpen] = useState(false);
  async function change(lang: string) {
    await api('/auth/me/lang', { body: { lang } });
    localStorage.setItem('heard.lang', lang);
    setOpen(false);
    await refresh();
  }
  return (
    <>
      <button className="btn ghost" aria-label={t.language} onClick={() => setOpen((o) => !o)}>
        🌐 {languageName(me.user.lang)}
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', top: '3.5rem', right: '0.5rem', left: '0.5rem', zIndex: 10 }}>
          <LanguagePicker value={me.user.lang} onChange={(l) => void change(l)} />
        </div>
      )}
    </>
  );
}

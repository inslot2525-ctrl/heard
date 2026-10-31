import { useEffect, useState } from 'react';
import { api, ApiError, session, type Lang, type User } from '../api';
import { LangContext, strings } from '../i18n';
import { LanguagePicker } from '../LanguagePicker';

type Mode = 'join' | 'login' | 'demo';

export function Welcome({ onLoggedIn }: { onLoggedIn: () => Promise<void> }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('heard.lang') as Lang) || 'en');
  const [mode, setMode] = useState<Mode>('join');
  const [newCode, setNewCode] = useState<string | null>(null);
  const t = strings(lang);

  useEffect(() => {
    localStorage.setItem('heard.lang', lang);
  }, [lang]);

  if (newCode) return <SaveCode lang={lang} code={newCode} onDone={onLoggedIn} />;

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <div className="page">
          <div>
            <div className="brand">Heard</div>
            <p className="tagline">{t.appTagline}</p>
          </div>
          <LanguagePicker value={lang} onChange={setLang} />
          {mode === 'join' && <JoinForm lang={lang} onJoined={setNewCode} />}
          {mode === 'login' && <LoginForm lang={lang} onDone={onLoggedIn} />}
          {mode === 'demo' && <DemoForm lang={lang} onDone={onLoggedIn} />}
          <div className="row" style={{ justifyContent: 'center' }}>
            {mode !== 'join' && <button className="btn ghost" onClick={() => setMode('join')}>{t.joinTitle}</button>}
            {mode !== 'login' && <button className="btn ghost" onClick={() => setMode('login')}>{t.haveLoginCode}</button>}
            {mode !== 'demo' && <button className="btn ghost" onClick={() => setMode('demo')}>{t.tryDemo}</button>}
          </div>
        </div>
      </div>
    </LangContext.Provider>
  );
}

function errorText(e: unknown, lang: Lang) {
  const t = strings(lang);
  if (e instanceof ApiError) {
    if (e.code === 'bad_code') return '❌ ' + (lang === 'en' ? 'That code didn’t work. Check it and try again.' : t.error);
    if (e.code === 'too_many_attempts') return lang === 'en' ? 'Too many tries. Wait a few minutes.' : t.error;
    if (e.code === 'missing_name') return lang === 'en' ? 'Please enter your name.' : t.yourName;
  }
  return t.error;
}

function JoinForm({ lang, onJoined }: { lang: Lang; onJoined: (loginCode: string) => void }) {
  const t = strings(lang);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ session: string; user: User; loginCode: string }>('/auth/join', { body: { code, name, lang } });
      session.set(r.session);
      onJoined(r.loginCode);
    } catch (e) {
      setErr(errorText(e, lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{t.joinTitle}</h2>
      <div className="field">
        <label htmlFor="code">{t.joinCode}</label>
        <input id="code" type="text" className="code-input" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} required />
        <small>{t.joinCodeHint}</small>
      </div>
      <div className="field">
        <label htmlFor="name">{t.yourName}</label>
        <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? t.sending : t.join}</button>
    </form>
  );
}

function SaveCode({ lang, code, onDone }: { lang: Lang; code: string; onDone: () => Promise<void> }) {
  const t = strings(lang);
  const [copied, setCopied] = useState(false);
  return (
    <div className="app">
      <div className="page">
        <div className="card">
          <h2>{t.saveCodeTitle}</h2>
          <p className="hint">{t.saveCodeBody}</p>
          <div className="code-box">{code}</div>
          <div className="row" style={{ marginTop: '0.75rem' }}>
            <button
              className="btn"
              onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true))}
            >
              {copied ? t.copied : t.copy}
            </button>
            <span className="spacer" />
            <button className="btn primary" onClick={() => void onDone()}>{t.savedIt}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ lang, onDone }: { lang: Lang; onDone: () => Promise<void> }) {
  const t = strings(lang);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ session: string }>('/auth/login', { body: { code } });
      session.set(r.session);
      await onDone();
    } catch (e) {
      setErr(errorText(e, lang));
      setBusy(false);
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>{t.haveLoginCode}</h2>
      <div className="field">
        <label htmlFor="lcode">{t.loginCode}</label>
        <input id="lcode" type="text" className="code-input" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="XXXX-XXXX-XXXX" />
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary block" disabled={busy}>{t.logIn}</button>
    </form>
  );
}

function DemoForm({ lang, onDone }: { lang: Lang; onDone: () => Promise<void> }) {
  const t = strings(lang);
  const [people, setPeople] = useState<{ id: string; name: string; role: string }[]>([]);
  const [passcode, setPasscode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<typeof people>('/auth/demo-users').then(setPeople).catch(() => setPeople([]));
  }, []);
  // Show the people who matter for the demo first.
  const order = ['demopriya', 'demorao', 'demowarden', 'demorohan', 'demokulkarni'];
  const sorted = [...people].sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));

  async function pick(userId: string) {
    setErr(null);
    try {
      const r = await api<{ session: string }>('/auth/demo-login', { body: { passcode, userId } });
      session.set(r.session);
      await onDone();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'bad_passcode' ? (lang === 'en' ? 'Wrong passcode.' : t.error) : errorText(e, lang));
    }
  }

  return (
    <div className="card">
      <h2>{t.tryDemo}</h2>
      <p className="hint">Sahyadri College (demo): invented people only.</p>
      <div className="field">
        <label htmlFor="pass">{t.demoPasscode}</label>
        <input id="pass" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="list">
        {sorted.slice(0, 8).map((p) => (
          <button key={p.id} className="item" onClick={() => void pick(p.id)} disabled={!passcode}>
            <span className="avatar">{p.name.replace(/^(Prof\.|Dr\.|Mrs\.)\s*/, '')[0]}</span>
            <span className="item-main">
              <span className="item-title">{p.name}</span>
              <span className="item-sub">{p.role}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

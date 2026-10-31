import { useEffect, useMemo, useRef, useState } from 'react';
import { HELPLINES, type FlagCard, type PulseResponse, type SafetyCard } from '@heard/shared';
import { useMe } from '../App';
import { api, type ChatItem, type Lang } from '../api';
import { chatKey, connectChat, loadHistory, onMessage, sendText, translateMessage, cachedTranslation, type ChatMessage } from '../chat-client';
import { useT } from '../i18n';
import { go, href } from '../router';
import { chatLabels, useChats } from './ChatList';

type Person = { id: string; name: string; role: string; lang: Lang };

function usePeople() {
  const [people, setPeople] = useState<Record<string, Person>>({});
  useEffect(() => {
    api<Person[]>('/chats/people').then((rows) => setPeople(Object.fromEntries(rows.map((p) => [p.id, p]))));
  }, []);
  return people;
}

function itemFromRoute(route: string[], chats: ChatItem[] | null): ChatItem | null {
  if (route[0] === 'direct' && route[1]) {
    return chats?.find((c) => c.kind === 'direct' && c.peerId === route[1]) ?? { kind: 'direct', peerId: route[1], title: route[1], role: 'staff' };
  }
  if (route[0] === 'community' && route[1] && route[2]) {
    return (
      chats?.find((c) => c.kind === 'community' && c.channelId === route[1] && c.subChannelId === route[2]) ?? {
        kind: 'community', channelId: route[1], subChannelId: route[2], title: route[2], role: 'hostel', canPost: true,
      }
    );
  }
  return null;
}

export function ChatScreen({ route }: { route: string[] }) {
  const t = useT();
  const { me } = useMe();
  const chats = useChats();
  const people = usePeople();
  const item = useMemo(() => itemFromRoute(route, chats), [route, chats]);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  // Shown right here when the safety check fires (the helpline card also goes to the assistant chat).
  const [showHelp, setShowHelp] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const key = item ? chatKey(item) : '';

  useEffect(() => {
    if (!item) return;
    let alive = true;
    setMessages(null);
    connectChat(me.user.id)
      .then(() => loadHistory(item))
      .then((h) => alive && setMessages(h))
      .catch(() => alive && setMessages([]));
    const off = onMessage((m) => {
      if (m.key !== key) return;
      setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
    });
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an effect must not return one.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !text.trim()) return;
    setSending(true);
    const sent = await sendText(item, text.trim()).catch(() => null);
    setSending(false);
    if (sent) {
      const body = text.trim();
      setText('');
      setMessages((list) => [...(list ?? []), sent]);
      if (me.user.role === 'student') {
        if (item.kind === 'direct' && item.role === 'assistant') {
          // The answer arrives in this chat from the bot, through Nexconn.
          setThinking(true);
          api('/assistant/ask', { body: { text: body, messageId: sent.id } }).catch(() => undefined).finally(() => setThinking(false));
        } else {
          // Until Nexconn webhooks are live, the app asks the server to check what was sent.
          api<{ alerted: boolean }>('/safety/check', { body: { text: body, messageId: sent.id } })
            .then((r) => r.alerted && setShowHelp(true))
            .catch(() => undefined);
        }
      }
    }
  }

  if (!item) return null;
  const label = chatLabels(item, t);
  const canPost = item.kind === 'direct' || item.canPost;

  return (
    <div className="chat">
      <header className="topbar">
        <a className="btn ghost" href={href()} aria-label={t.back}>←</a>
        <h1>
          {label.title}
          {label.subtitle && <span className="sub">{label.subtitle}</span>}
        </h1>
      </header>
      <div className="messages" aria-live="polite">
        {messages === null && <div className="status">{t.connecting}</div>}
        {messages?.length === 0 && <div className="status">{t.noMessages}</div>}
        {messages?.map((m) => (
          <MessageView key={m.id} m={m} sender={people[m.from]} showSender={item.kind === 'community'} myLang={me.user.lang} />
        ))}
        {thinking && <div className="status">{t.assistantTyping}</div>}
        {showHelp && <SafetyCardView c={{ helplines: HELPLINES }} />}
        <div ref={bottom} />
      </div>
      {canPost ? (
        <form className="composer" onSubmit={send}>
          <textarea
            aria-label={t.typeMessage}
            placeholder={t.typeMessage}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
            }}
          />
          <button className="btn primary" disabled={sending || !text.trim()}>{t.send}</button>
        </form>
      ) : (
        <div className="notice-bar">{t.onlyWardensPost}</div>
      )}
    </div>
  );
}

function time(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageView({ m, sender, showSender, myLang }: { m: ChatMessage; sender?: Person; showSender: boolean; myLang: Lang }) {
  return (
    <div className={`msg${m.mine ? ' mine' : ''}`}>
      {showSender && !m.mine && <div className="sender">{sender?.name ?? m.from}</div>}
      <Body m={m} sender={sender} myLang={myLang} />
      <div className="meta">{time(m.sentTime)}</div>
    </div>
  );
}

function Body({ m, sender, myLang }: { m: ChatMessage; sender?: Person; myLang: Lang }) {
  switch (m.type) {
    case 'RC:TxtMsg':
      return <TextBubble m={m} sender={sender} myLang={myLang} />;
    case 'RC:StreamMsg':
      return <div className="bubble">{m.content?.content ?? ''}</div>;
    case 'SA:PulseCard':
      return <PulseCardView week={m.content?.week} />;
    case 'SA:PulseResp':
      return <PulseRespView r={m.content as PulseResponse} />;
    case 'SA:FlagCard':
      return <FlagCardView f={m.content as FlagCard} />;
    case 'SA:SafetyCard':
      return <SafetyCardView c={m.content as SafetyCard} />;
    default:
      return <div className="bubble muted">[{m.type}]</div>;
  }
}

/**
 * Text with translation. Incoming messages from someone whose language differs from mine are
 * translated automatically; the original always stays visible (machine translation can drop a
 * key word, see docs/SPIKES.md C).
 */
function TextBubble({ m, sender, myLang }: { m: ChatMessage; sender?: Person; myLang: Lang }) {
  const t = useT();
  const text: string = m.content?.text ?? '';
  const auto = !m.mine && Boolean(sender) && sender!.lang !== myLang;
  const [translation, setTranslation] = useState<string | null>(() => cachedTranslation(m.id, myLang));
  const [state, setState] = useState<'idle' | 'busy' | 'hidden' | 'failed'>('idle');

  function run() {
    setState('busy');
    translateMessage(m, myLang, sender?.lang).then((out) => {
      setTranslation(out);
      setState(out === null ? 'failed' : 'idle');
    });
  }

  useEffect(() => {
    if (auto && translation === null) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const same = translation !== null && translation.trim() === text.trim();
  return (
    <div className="bubble">
      {text}
      {translation !== null && !same && state !== 'hidden' && (
        <div className="translation">
          <div className="label">{t.translatedFrom}</div>
          {translation}
        </div>
      )}
      {!m.mine && (
        <div>
          {translation === null && state !== 'busy' && (
            <button className="linkish" onClick={run}>{t.translate}</button>
          )}
          {state === 'busy' && <span className="small muted">{t.translating}</span>}
          {translation !== null && !same && (
            <button className="linkish" onClick={() => setState(state === 'hidden' ? 'idle' : 'hidden')}>
              {state === 'hidden' ? t.showTranslation : t.showOriginal}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PulseCardView({ week }: { week?: string }) {
  const t = useT();
  const { me } = useMe();
  return (
    <div className="mcard accent">
      <div className="t">{t.pulseCardTitle}</div>
      <div className="small muted">{week}</div>
      {me.user.role === 'student' && (
        <button className="btn primary" style={{ marginTop: '0.5rem' }} onClick={() => { go(); setTimeout(() => document.getElementById('checkin')?.scrollIntoView(), 50); }}>
          {t.pulseCardOpen}
        </button>
      )}
    </div>
  );
}

const AREAS = ['studies', 'money', 'health', 'home'] as const;

function PulseRespView({ r }: { r: PulseResponse }) {
  const t = useT();
  if (!r?.levels) return <div className="bubble muted">[check-in]</div>;
  return (
    <div className="mcard">
      <div className="t">{t.pulseRespTitle} · {r.week}</div>
      <div className="levels-summary">
        {AREAS.map((a) => (
          <span key={a} style={{ display: 'contents' }}>
            <span className="dot" data-level={r.levels[a]} style={{ alignSelf: 'center' }} />
            <span>{t[a]}: {[t.struggling, t.ok, t.good][r.levels[a]]}</span>
          </span>
        ))}
      </div>
      {r.note && <div className="quote" style={{ marginTop: '0.5rem' }}>{r.note}</div>}
      {r.wantsToTalk && <div className="pill" style={{ marginTop: '0.5rem' }}>{t.wantsToTalk}</div>}
    </div>
  );
}

function FlagCardView({ f }: { f: FlagCard }) {
  const t = useT();
  return (
    <div className="mcard accent">
      <div className="t">{f.studentName}</div>
      <div className="flag-reason small">{f.reason}</div>
      {f.studentWords && <div className="quote small" style={{ marginTop: '0.4rem' }}>{f.studentWords}</div>}
      <a className="btn primary" style={{ marginTop: '0.5rem' }} href={href('flag', f.flagId)}>{t.inbox} →</a>
    </div>
  );
}

/** Helplines, shown right after a safety keyword. Numbers are tap-to-call. */
function SafetyCardView({ c }: { c: SafetyCard }) {
  const t = useT();
  return (
    <div className="mcard safety" role="alert">
      <div className="t">{t.safetyTitle}</div>
      <p className="small" style={{ margin: '0 0 0.5rem' }}>{t.safetyBody}</p>
      {c.helplines?.map((h) => (
        <a key={h.number} className="btn block" style={{ marginBottom: '0.35rem', justifyContent: 'space-between' }} href={`tel:${h.number.replace(/[^0-9+]/g, '')}`}>
          <span>{h.name}</span>
          <strong>{h.number}</strong>
        </a>
      ))}
    </div>
  );
}

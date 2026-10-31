// Spike lab (docs/SPIKES.md). Log in, then run `pnpm --filter @heard/api spike <cmd>` and watch the log.
// A: direct messages between two windows. B: custom "SA:*" messages. C: translation. D: bot + stream.
// E: community channel messages.

import { useRef, useState } from 'react';
import {
  AreaCode,
  DirectChannel,
  MessageHandler,
  NCEngine,
  SendTextMessageParams,
  TranslateHandler,
  TranslateTextParam,
} from '@nexconn/chat';
import { MSG } from '@heard/shared';

import { API } from './api';
const APP_KEY = import.meta.env.VITE_NEXCONN_APP_KEY as string | undefined;

let initialized = false;

function short(v: unknown) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s && s.length > 300 ? `${s.slice(0, 300)}…` : s;
}

export function SpikeLab() {
  // Seeded demo personas (pnpm --filter @heard/api seed:demo): demopriya, demorao, demowarden, …
  const [userId, setUserId] = useState('demopriya');
  const [passcode, setPasscode] = useState('');
  const [peer, setPeer] = useState('demorao');
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const add = (line: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()}  ${line}`]);
  const handlersAdded = useRef(false);

  async function login() {
    try {
      if (!APP_KEY) return add('VITE_NEXCONN_APP_KEY is not set in the root .env');
      const r = await fetch(`${API}/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, userId }),
      });
      const login = await r.json();
      if (!r.ok) return add(`login failed: ${JSON.stringify(login)}`);
      const t = await fetch(`${API}/auth/nexconn-token`, { method: 'POST', headers: { Authorization: `Bearer ${login.session}` } });
      const j = await t.json();
      if (!t.ok) return add(`token failed: ${JSON.stringify(j)}`);
      if (!initialized) {
        NCEngine.initialize({ appKey: APP_KEY, areaCode: AreaCode.SG });
        // B: register our custom types so the SDK can parse them. Must happen before connect.
        NCEngine.registerCustomMessages(
          Object.values(MSG).map((messageType) => ({ messageType, isPersisted: true, isCounted: true })),
        );
        initialized = true;
      }
      if (!handlersAdded.current) {
        NCEngine.addMessageHandler(
          'lab',
          new MessageHandler({
            onMessageReceived: ({ messages }) => {
              for (const m of messages) {
                const id = m.channelIdentifier;
                const sub = (id as { subChannelId?: string }).subChannelId;
                add(
                  `RECV ${m.messageType} · channelType ${id.channelType} · ${id.channelId}${sub ? `/${sub}` : ''} · from ${m.senderUserId} · ${short(m.content)}`,
                );
              }
            },
            onStreamMessageRequestInit: (e) => add(`STREAM init ${e.messageId}`),
            onStreamMessageRequestDelta: (e) => add(`STREAM delta → so far: "${e.chunkInfo.messageContent}"`),
            onStreamMessageRequestComplete: (e) => add(`STREAM complete ${e.messageId} code ${e.code}`),
          }),
        );
        NCEngine.addTranslateHandler(
          'lab',
          new TranslateHandler({
            onTranslationCompleted: (e) => add(`TRANSLATED ${short(e.results)}`),
          }),
        );
        handlersAdded.current = true;
      }
      const res = await NCEngine.connect({ token: j.token });
      add(`connect → code ${res.code}${res.code === 0 ? `, user ${res.data?.userId}` : ''}`);
      setConnected(res.code === 0);
    } catch (e) {
      add(`error: ${String(e)}`);
    }
  }

  async function send() {
    const { code } = await new DirectChannel(peer).sendMessage(new SendTextMessageParams({ text }));
    add(`sent to ${peer} → code ${code}`);
    if (code === 0) setText('');
  }

  // C: translation. Needs "Translation" switched on in the console (Chat > Chat settings > Messages).
  async function translate() {
    const r = await NCEngine.translateModule.translateTexts({
      list: [
        new TranslateTextParam('मला घरची खूप आठवण येते', 'auto', 'en'),
        new TranslateTextParam('Shall we talk after dinner today?', 'en', 'mr'),
        new TranslateTextParam('Can we talk after dinner today?', 'en', 'hi'),
      ],
    });
    add(`translateTexts → code ${r.code}${r.code === 0 ? ' (results arrive as TRANSLATED)' : ` ${short(r)}`}`);
  }

  function settings() {
    const r = NCEngine.getAppSettings();
    add(`app settings → ${r.isOk ? `speechToText ${r.data!.isSpeechToTextEnabled}, edit window ${r.data!.messageModifiableMinutes} min` : short(r)}`);
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 820, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Heard · spike lab</h1>
      <fieldset disabled={connected}>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user id" />{' '}
        <input value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="demo passcode" type="password" />{' '}
        <button onClick={login}>Log in + connect</button>
      </fieldset>
      <fieldset disabled={!connected} style={{ marginTop: '1rem' }}>
        <input value={peer} onChange={(e) => setPeer(e.target.value)} placeholder="send to" />{' '}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="message" />{' '}
        <button onClick={send} disabled={!text}>
          Send
        </button>{' '}
        <button onClick={translate}>Test translation</button> <button onClick={settings}>App settings</button>{' '}
        <button onClick={() => setLog([])}>Clear</button>
      </fieldset>
      <pre id="log" style={{ background: '#f4f4f5', padding: '1rem', whiteSpace: 'pre-wrap', minHeight: 160, fontSize: 12 }}>
        {log.join('\n')}
      </pre>
    </main>
  );
}

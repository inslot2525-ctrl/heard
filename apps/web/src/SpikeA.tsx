// Spike A (docs/SPIKES.md): token from our server → connect → send and receive a direct message.
// Open two windows, log in as "alice" and "bob", send to each other.
// API names come from docs.nexconn.ai/chatsdk-web; if the SDK differs, fix here and note it in SPIKES.md.

import { useEffect, useRef, useState } from 'react';
import { AreaCode, DirectChannel, MessageHandler, NCEngine, SendTextMessageParams } from '@nexconn/chat';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const APP_KEY = import.meta.env.VITE_NEXCONN_APP_KEY as string | undefined;

let initialized = false;

export function SpikeA() {
  const [userId, setUserId] = useState('alice');
  const [passcode, setPasscode] = useState('');
  const [peer, setPeer] = useState('bob');
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const add = (line: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()}  ${line}`]);
  const handlerAdded = useRef(false);

  useEffect(() => {
    if (!APP_KEY) add('VITE_NEXCONN_APP_KEY is not set in the root .env');
  }, []);

  async function login() {
    try {
      const r = await fetch(`${API}/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, userId, name: userId }),
      });
      const j = await r.json();
      if (!r.ok) return add(`login failed: ${JSON.stringify(j)}`);
      if (!initialized) {
        NCEngine.initialize({ appKey: APP_KEY!, areaCode: AreaCode.SG });
        initialized = true;
      }
      if (!handlerAdded.current) {
        NCEngine.addMessageHandler(
          'spike-a',
          new MessageHandler({
            onMessageReceived: (event: unknown) => add(`received: ${JSON.stringify(event)}`),
          }),
        );
        handlerAdded.current = true;
      }
      const res = await NCEngine.connect({ token: j.token });
      add(`connect → code ${res.code}${res.code === 0 ? `, user ${res.data?.userId}` : ''}`);
      setConnected(res.code === 0);
    } catch (e) {
      add(`error: ${String(e)}`);
    }
  }

  async function send() {
    try {
      const channel = new DirectChannel(peer);
      const { code } = await channel.sendMessage(new SendTextMessageParams({ text }));
      add(`sent to ${peer} → code ${code}`);
      if (code === 0) setText('');
    } catch (e) {
      add(`send error: ${String(e)}`);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Heard · spike A</h1>
      <p>Log in as one user here and another in a second window, then message each other.</p>
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
        </button>
      </fieldset>
      <pre style={{ background: '#f4f4f5', padding: '1rem', whiteSpace: 'pre-wrap', minHeight: 120 }}>{log.join('\n')}</pre>
    </main>
  );
}

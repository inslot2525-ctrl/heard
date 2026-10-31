// Server side of the spikes. Usage: pnpm --filter @heard/api spike <users|d-text|d-stream|b|e>
// Log in as "alice" in the web spike lab first, then run a command and watch the lab's log.

import { MSG, type PulseCard } from '@heard/shared';
import { env, nexconnConfigured } from '../src/env.js';
import { Nexconn, NexconnError } from '../src/nexconn.js';

if (!nexconnConfigured) throw new Error('Set NEXCONN_APP_KEY and NEXCONN_APP_SECRET in the root .env');
const nx = new Nexconn({ appKey: env.nexconnAppKey!, appSecret: env.nexconnAppSecret!, apiHost: env.nexconnApiHost });

const BOT = 'heardDemobot'; // the demo campus's assistant (botIdFor('heardDemo'))
const STUDENT = 'demopriya';
const MENTOR = 'demorao';
const COMMUNITY = 'heardDemo';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const commands: Record<string, () => Promise<unknown>> = {
  // Make sure every spike user exists (issuing a token registers the user).
  async users() {
    for (const [id, name] of [
      [STUDENT, 'Alice (student)'],
      [MENTOR, 'Bob (mentor)'],
      [BOT, 'Heard Assistant'],
    ]) {
      await nx.issueAccessToken(id, name);
      console.log(`user ${id} ready`);
    }
  },

  // D1: the bot sends a plain text message from the server.
  async 'd-text'() {
    return nx.sendDirectText(BOT, STUDENT, 'Hi Alice, I am the Heard assistant. Mess dinner is 7:30–9:30 pm.');
  },

  // D2: the bot streams a reply in chunks, like an LLM would.
  async 'd-stream'() {
    async function* chunks() {
      for (const part of ['Leave forms ', 'are submitted ', 'to the warden ', 'by 6 pm, ', 'two days ahead.']) {
        yield part;
        await sleep(400);
      }
    }
    return { messageId: await nx.sendDirectStream(BOT, STUDENT, chunks()) };
  },

  // B: a custom PulseCard from the server. The web lab registers SA:* types before connecting.
  async b() {
    const card: PulseCard = { pulseId: 'p-demo-1', week: '2026-W45', areas: ['studies', 'money', 'health', 'home'] };
    return nx.sendDirect({
      from: BOT,
      to: [STUDENT],
      messageType: MSG.PulseCard,
      content: JSON.stringify(card),
      pushContent: 'Your weekly check-in is here',
    });
  },

  // E: community channel with a public hostel subchannel and a private mentors subchannel.
  async e() {
    const step = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        console.log(`✓ ${label}`);
      } catch (err) {
        console.log(`✗ ${label}: ${err instanceof NexconnError ? JSON.stringify(err.body) : String(err)}`);
      }
    };
    await step('create community', () => nx.createCommunity(COMMUNITY, 'Heard Demo Campus', MENTOR));
    await step('subchannel hostelA (public)', () => nx.createSubchannel(COMMUNITY, 'hostelA', 0));
    await step('subchannel mentors (private)', () => nx.createSubchannel(COMMUNITY, 'mentors', 1));
    await step('join alice', () => nx.joinCommunity(COMMUNITY, STUDENT));
    await step('join bob', () => nx.joinCommunity(COMMUNITY, MENTOR));
    await step('notice in hostelA', () =>
      nx.sendCommunity({
        from: BOT,
        channelId: COMMUNITY,
        subchannelId: 'hostelA',
        messageType: 'RC:TxtMsg',
        content: JSON.stringify({ content: 'Hostel A: water supply off 10–11 am tomorrow.' }),
      }),
    );
    await step('message in default subchannel', () =>
      nx.sendCommunity({ from: BOT, channelId: COMMUNITY, messageType: 'RC:TxtMsg', content: JSON.stringify({ content: 'Welcome to the campus community.' }) }),
    );
  },
};

const cmd = process.argv[2];
if (!cmd || !commands[cmd]) {
  console.log(`commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}
try {
  const out = await commands[cmd]();
  if (out !== undefined) console.log(JSON.stringify(out));
} catch (err) {
  console.error(err instanceof NexconnError ? `${err.message} ${JSON.stringify(err.body)}` : err);
  process.exit(1);
}

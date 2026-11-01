# Spike results (Nov 2–4)

One section per spike from the spec §7. Record what works, the exact package and API names, and any surprises.

## Known from the docs (Oct 31, before any keys)

- Packages: `@nexconn/engine` + `@nexconn/chat` (26.2.1). Chat UI: `@nexconn/chatui` (26.2.5), Lit web components, root tag `nc-chat-ui-app-provider`; initialise `NCEngine` **before** `NCChatUIApplication`. Its docs only show a Vue setup; React will need the custom element mounted manually.
- Client init: `NCEngine.initialize({ appKey, areaCode: AreaCode.SG })`. The App Key's data centre must match `areaCode`.
- Server auth: headers `App-Key`, `Nonce` (≤18 chars), `Timestamp` (ms), `Signature = sha1(secret + nonce + timestamp)`. JSON bodies.
- Base URL (Singapore): `api.sg-light-api.com`, backup `api-b.sg-light-api.com`.
- Token: `POST /v4/auth/access-token/issue` `{ userId, name, avatarUrl? }` → `result.accessToken`.
- `apps/web` type-checks against the real SDK: `DirectChannel`, `SendTextMessageParams`, `MessageHandler`, `NCEngine.addMessageHandler`, `AreaCode` all exist.

## A. Token from server + first message from web
**✅ Passed, Oct 31.** Singapore app.

- Server: signed `POST /v4/auth/access-token/issue` works first try; tokens are 84 characters.
- Client: `NCEngine.initialize({ appKey, areaCode: AreaCode.SG })` → `NCEngine.connect({ token })` returns `code 0`.
- `new DirectChannel('alice').sendMessage(new SendTextMessageParams({ text }))` returns `code 0`; the other tab receives it in under a second.
- **Gotcha: the receive event shape.** `onMessageReceived` gets **a batch**, `{ messages: Message[] }`, not one message. Each message has `messageId`, `senderUserId`, `sentTime`, `direction` (2 = incoming), `_identifier: { _channelType: 1 (direct), _channelId: <peer id> }`, `_registeredParams.messageType` (`"RC:TxtMsg"`), and the text in `_content.text`. Don't read the `_` fields: `Message` has public getters `content`, `messageType`, `channelIdentifier` (→ `.channelType`, `.channelId`; community messages also have `.subChannelId`), plus plain fields `messageId`, `senderUserId`, `sentTime`.
- Notepad saves `.env` as `.env.txt` by default. Check the file name if the API says `nexconn: false`.

How to rerun: `pnpm dev`, log in as `alice` in the spike lab (`apps/web/src/SpikeLab.tsx`), then
`pnpm --filter @heard/api spike <users|d-text|d-stream|b|e>` (`apps/api/scripts/spike.ts`) and watch the lab log.

## B. Custom messages
**SDK level ✅. Decision: no `@nexconn/chatui`; own React chat screens (Oct 31).**

- The Chat UI quickstart says: *"Portrait mobile browsers are not a supported target for the UI today"*, and it supports only **direct, group and system channels**, not community channels. Heard is phone-first and uses community channels, so we render our own message list and cards on top of `@nexconn/chat`. Chat SDK use alone satisfies the challenge rule.
- (For reference, if anyone revisits it: Chat UI custom bubbles are web components registered with `app.registerCustomMessages([{ messageType, component: { tagName, elementClass }, digest }])`, rendered as `nc-c-<tagName>`.)
- **Check:** the same quickstart says the Free plan is *"valid for one month"*, while the Free Chat Plan page says 10K MAU free for a year. Confirm the expiry date in the console.

- Register before `connect`: `NCEngine.registerCustomMessages([{ messageType: 'SA:PulseCard', isPersisted: true, isCounted: true }])`. We register every type in `MSG` from `@heard/shared`.
- Server sends with `POST /v4/direct-channel/message/send`, `messageType: 'SA:PulseCard'`, `content: JSON.stringify(card)`. The web client receives `messageType 'SA:PulseCard'` with `content` **already parsed** into the object.
- Custom types must not start with `RC:` and must be ≤32 characters. Unregistered types reach the client but can't be parsed.
- Cards are rendered by our own React components from the parsed `content`.

## C. Built-in translation (hi / mr)
**✅ Works for en / mr / hi / ta (Oct 31), with three caveats below.** Console: Chat → Chat settings → Messages → Translation → on (10,000 characters free, then a card is needed). While it's off, calls return **`code 28400`**.

- **Messages:** `NCEngine.translateModule.translateMessages({ list: [new TranslateMessageParam(message.messageId, 'auto', 'en', message.content.text)], force: false })`. On Web the 4th argument (the original text) is required. The result arrives in about a second through `NCEngine.addTranslateHandler(id, new TranslateHandler({ onTranslationCompleted }))`: `results[i].identifier === messageId`, `sourceType 0`, and `translateInfo.translatedText`.
- **Free text:** `translateTexts({ list: [new TranslateTextParam(text, 'auto', 'mr')] })` → the same handler, with `sourceType 1`.
- **Caveat 1, no auto-translate.** The docs say: *"The Chat SDK does not include built-in auto-translate functionality."* `setTranslationLanguage`, `setAutoTranslateEnabled` and `setTranslateStrategy([...], TranslateStrategy.AUTO_ON)` only store preferences, synced across devices. **Our message list must call `translateMessages` for each incoming message** when the user's preference is on. The enum is `DEFAULT / AUTO_ON / AUTO_OFF`; the SDK's doc comment says `AUTO`, which doesn't exist and returns 35062.
- **Caveat 2, not persisted.** The translation isn't saved on the message (history comes back without it). Cache it ourselves by `messageId` (client storage, or our DB for mentor views).
- **Caveat 3, batches can fail.** Three texts in one `translateTexts` call: one returned **`28401`**. The same three sent one per call all succeeded. Send one per call, or retry failed items.
- **Quality, important for Heard.** Marathi *"या आठवड्यात पैशांची थोडी अडचण आहे, फी भरायला उशीर होईल"* (money trouble this week, fee will be late) came back as *"There's a bit of money this week, it'll be late to fill the fee"*: **it dropped अडचण (trouble) and inverted the meaning.** Short phrases were fine ("मला घरची खूप आठवण येते" → "I miss home a lot."). Hindi output defaults to the masculine form. Rules for the build:
  1. Always show the original next to the translation, with a toggle.
  2. Flags never depend on translated text; they come from one-tap pulse answers (already true in `packages/shared/src/rules.ts`).
  3. Give mentors a "check translation" action that re-translates the student's note with our LLM for comparison.
- **Second failure (Oct 31, in the real UI):** *"हो सर, आज रात्रीच्या जेवणानंतर बोलूया का?"* ("Yes sir, shall we talk after dinner tonight?") came back as **"be sir, today's ratrilogy today?"**. English → Marathi was fine. **Decision: translate Marathi (and likely Hindi) with Gemini; keep Nexconn translation only where it holds up.** Needs `GEMINI_API_KEY`.
- **Chinese ↔ English is excellent (Oct 31, real UI):** *"老师您好，我想问一下下周的实习报告可以晚交两天吗？"* → *"Hello, teacher, I would like to ask if the internship report for next week can be handed in two days later?"*; the reply came back as natural Chinese and even rendered "Li Na" as 李娜. Demo persona `demolina` (Li Na, exchange student, mentor Prof. Rao) shows this.
- **Gemini fixes Marathi (Oct 31, real UI):** the same two sentences now read *"Yes sir, shall we talk after dinner tonight?"* and *"I am having a bit of a financial difficulty this week, so the fee payment will be delayed."* Routing: if either side is an Indian language (`LLM_TRANSLATED` in `packages/shared/src/languages.ts`) the web app calls `POST /translate` (Gemini); otherwise Nexconn. Gemini failure falls back to Nexconn.
- **Gemini reliability:** `gemini-flash-latest` returned 503 "high demand" and once took 58 s. We use a chain with an 8 s timeout each: `gemini-3.5-flash-lite` (≈1 s) → `gemini-3.5-flash` → `gemini-2.5-flash`, 5 s each (Nov 1: 3.1-flash-lite was overloaded, 503 after 12–15 s) (override with `GEMINI_MODELS`).
- **Speech-to-text exists in the SDK** even though the docs don't cover it: `voiceMessage.requestSpeechToText()` → `onSpeechToTextCompleted`. `NCEngine.getAppSettings().data.isSpeechToTextEnabled` is currently **false**; it needs a console switch too. That would cover voice notes in Marathi without our own speech-to-text (spec S6).

## D. Bot replies from server (+ stream messages)
**Text ✅, stream ⚠️ (Oct 31).**

- A bot is just a normal user. Issue a token once (`heardbot`, "Heard Assistant"), then the server sends as it: `sendDirectText('heardbot', 'alice', …)` arrives instantly as `RC:TxtMsg` from `heardbot`.
- Streaming: `POST /v4/direct-channel/message/stream/send` with `RC:StreamMsg` chunks (`seq` from 1, `messageId` from the first response, `complete: true` to end) is accepted (`code 0`).
- **Problem: the web SDK (26.2.1) never fires `onMessageReceived` for a server-sent stream.** Tested twice. The message is in history (`BaseChannel.createMessagesQuery`) holding only the first chunk with `isCompleted: false`. Calling `message.requestStreamMessage()` on it then fires `onStreamMessageRequestInit/Delta/Complete` with the full text.
- **Decision for now:** the bot sends plain `RC:TxtMsg` (instant, and the spec's fallback). Worth a GitHub issue on `NexconnAI-Dev/hackathon`. If they fix it, streaming is a stretch item.

## E. Community channel on the free plan
**✅ Works on the free plan (Oct 31)**, although the docs say community channels need Pro.

- Server: `createCommunity('heardDemo', name, firstMemberId)` → `createSubchannel(id, 'hostelA', 0)` public / `(id, 'mentors', 1)` private → `joinCommunity(id, userId)` (one user per call) → `sendCommunity({ subchannelId })`.
- IDs are **letters and digits only**: community ≤64 characters, subchannel ≤20, max 50 subchannels.
- Client receives `channelType 10` with `channelIdentifier.channelId = 'heardDemo'` and `subChannelId = 'hostelA'`; messages without a subchannel land in **`RCDefault`**.
- **Private subchannels hold:** a message sent to `mentors` did not reach `alice`. Members must be added to a private subchannel explicitly (`private-channel/add-to-private-channel-users`); joining the community isn't enough.

## F. Webhooks for sent messages
**✅ Receiver built (Oct 31): `POST /webhooks/nexconn` (`apps/api/src/routes/webhooks.ts`).** It checks the App Key and the signature, rejects timestamps more than 5 minutes off (replays), replies at once, and processes afterwards. On `message:send`, every RC:TxtMsg from a student (not `os: Server`) goes through the safety check. A unique `safety_events.message_id` means a message alerts once, even if the webhook, Nexconn's retries and the app's `/safety/check` all report it.
- Gotcha: a router mounted at `/` with `use('*', requireSession)` also caught `/webhooks/*` (401 `not_logged_in`). Middleware is now scoped to its own paths.

- Console: Chat → Chat settings → Webhooks → Config → URL + events. One URL for all events.
- Events we want: `message:send` (all messages: pulse replies, bot questions), and **`direct_channel:pre_messaging`** / `group_channel:pre_messaging` (free plan), which can **block or modify a message before delivery**. Good fit for the safety path (F7).
- Verification: headers `AppKey`, `Nonce`, `Timestamp`, `Signature = sha1(secret + nonce + timestamp)`. Implemented as `verifyWebhook()` in `apps/api/src/nexconn.ts`.
- Delivery: 5 s timeout, 2 retries, any 2xx = success. Singapore source IPs are listed in the docs if we ever allowlist.

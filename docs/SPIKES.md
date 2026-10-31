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
- **Gotcha: the receive event shape.** `onMessageReceived` gets **a batch**, `{ messages: Message[] }`, not one message. Each message has `messageId`, `senderUserId`, `sentTime`, `direction` (2 = incoming), `_identifier: { _channelType: 1 (direct), _channelId: <peer id> }`, `_registeredParams.messageType` (`"RC:TxtMsg"`), and the text in `_content.text`. Don't read the `_` fields: the typings (`index.d.ts`) have public getters `message.content`, `message.messageType`, `message.channelId`, `message.channelType` and `message.identifier`.
- Notepad saves `.env` as `.env.txt` by default. Check the file name if the API says `nexconn: false`.

## B. Custom messages in Chat UI (web)
## C. Built-in translation (hi / mr)
## D. Bot replies from server (+ stream messages)
## E. Community channel on the free plan
## F. Webhooks for sent messages

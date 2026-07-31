# AI Chat Assessment — Response & Process

## What I built

I built a chat web app that talks to a generative AI API and streams replies into the UI without a page reload. It covers the main requirements: a text input you can submit, calls to OpenAI Chat Completions (`gpt-4o-mini` by default), React state so the page never fully reloads, loading states (typing dots before the first token, a streaming caret after, and a Stop button to cancel), and error handling for empty prompts, a missing API key, timeouts, network failures, and 401/429/5xx responses.

The UI is broken into feature-sliced React components under `src/features/chat/`, uses semantic HTML (`aside`, `main`, `header`, `footer`, `form`, `label`, `article`, dialog roles), and is responsive — desktop gets a sidebar, mobile gets a drawer, and each pane scrolls on its own.

I also picked up a few bonuses: multi-session history in LocalStorage (`fivetran-chat-sessions`) with titles in the sidebar, New/Clear/Delete chat (delete asks for confirmation), markdown rendering on assistant replies via `react-markdown`, unit tests with Vitest and Testing Library, and SSE streaming so tokens show up as they arrive.

Stack is Vite, React 19, and TypeScript, with plain CSS (ChatGPT-style layout, neutral “AI Chat” branding). OpenAI is called with `fetch` — no SDK. Tests use Vitest, Testing Library, and Oxlint.

```bash
npm install
cp .env.example .env   # set VITE_OPENAI_API_KEY
npm run dev
npm test
npm run build
```

## How I approached it

The brief allowed OpenAI, Hugging Face, or Anthropic. I went with OpenAI because Chat Completions already thinks in turns (`messages[]` with `user` / `assistant`), which maps cleanly to a chat UI, streaming is built in (`stream: true` + SSE), and `gpt-4o-mini` is cheap enough for a take-home while still being good enough to demo with. The one caveat I accepted is putting a `VITE_*` key in the browser. Fine for a take-home with no backend; in production I'd proxy it through a server.

I started from the Vite scaffold and reshaped it into a feature-sliced layout. I wanted responsibilities to be obvious without over-engineering a single feature:

```
src/App.tsx                      → thin shell
src/features/chat/
  domain/                        → types + pure helpers (no I/O)
  application/useChat.ts         → screen orchestration
  infrastructure/                → OpenAI gateway, LocalStorage, error mapping
  ui/                            → ChatRoute + presentational components
  index.ts                       → public barrel
```

The architecture is basically four layers inside one feature. Domain owns the chat model (`ChatState`, sessions, messages) and all the pure transitions like start/clear/delete, title derivation, and appending a stream delta. Nothing in domain knows about React, `fetch`, or LocalStorage, which made it the easiest place to put unit tests and the safest place to encode “what should happen” without UI timing getting in the way.

`useChat` is the application layer. It holds React state, wires actions from the UI to domain updates, and owns the in-flight request lifecycle through an `AbortController` plus refs for the streaming session and message ids. Infrastructure is where the messy world lives: `chatGateway` speaks OpenAI SSE, `openaiErrors` maps failures into readable copy, and `chatStorage` reads/writes LocalStorage. UI stays presentational — `ChatRoute` composes the sidebar, message list, composer, error banner, and confirm dialog, and pushes events back up through the hook. Enough structure to stay oriented, not a full Clean Architecture ceremony.

A design choice that mattered a lot once sessions existed: stream updates are keyed by session id, not “whatever is currently active.” `appendMessageDelta` and `updateSessionMessages` no-op if that session was deleted. Switching chats mid-stream keeps tokens on the originating session instead of leaking into the one you’re looking at. Clearing or deleting the streaming session aborts the request; intentional aborts don’t show an error banner. I also block a second send while a stream is already in flight rather than trying to juggle concurrent requests in the client.

When you send a message, `ChatInput` submits into `useChat`, which rejects empty or whitespace-only prompts. A user message and an empty assistant placeholder land in session state, then `streamChatCompletion` hits OpenAI with prior turns plus the new message (empty assistant placeholders are filtered out of the API payload). Each SSE delta appends on the originating session. On failure you get a readable banner; any partial text that already arrived is kept, and an empty assistant bubble is dropped if nothing streamed. Sessions only persist to LocalStorage when you’re not actively streaming, so we don’t thrash writes mid-stream or save half-finished assistant bubbles every token.

A single flat message list wasn’t going to work once “New chat” entered the picture — you’d lose context the second you started fresh. So each session has an `id`, `title`, `messages`, and `updatedAt`, and the sidebar lists them newest-first. New chat creates an empty session (no-op if you’re already on an empty one). Clear chat empties the active session’s messages but keeps the session around. Delete chat removes a session after a confirmation dialog, and deleting the last one always leaves a fresh empty session behind so the UI never ends up with nowhere to type. Older single-array LocalStorage data migrates automatically. I put a confirmation on delete because it’s irreversible; clear is softer, so it stays one click in the header.

Most of the edge-case work lived in streaming, storage, and errors. Streaming has to survive malformed SSE lines (skip them), `[DONE]`, and JSON chunks with empty deltas. Requests use a 120s timeout via `AbortSignal.timeout`, and the gateway distinguishes intentional aborts from real timeouts/network failures. Missing API key, 401, 429, and 5xx each get specific copy instead of a generic “something failed.” Empty model output is treated as an error. None of these wipe the conversation you’ve already had.

Storage is defensive too: corrupt JSON falls back to a fresh session, invalid session/message shapes get filtered out, a missing `activeSessionId` falls back to the first valid session, and `QuotaExceededError` / private-mode write failures are swallowed so the in-memory chat still works. On the UI side, send is disabled for empty/whitespace prompts, the confirm dialog traps focus and supports Escape, and streaming shows dots until the first token then a blinking caret.

For UX I leaned on the familiar chat layout — sidebar, centered transcript, composer at the bottom — without copying anyone’s branding. Sidebar scroll and chat scroll are separate (`100svh` shell, overflow on each pane). Markdown only applies to assistant messages; user text stays plain.

I focused tests on the stuff that actually breaks if it regresses: domain logic for session start/clear/delete, history ordering, truncation, and session-scoped deltas; gateway SSE parsing and HTTP/status error mapping; storage save/load, legacy migration, and corrupt JSON; `useChat` behavior around empty prompts, streaming after a session switch, abort on clear/delete, and error cleanup; and ChatInput / ConfirmDialog send rules plus cancel-first focus, Tab trap, and Escape. I check CSS layout by hand. Logic is covered by unit tests (`npm test`).

If this were going to production, I’d add a backend proxy for the API key, rate limiting and retry with backoff, a deployed preview URL for reviewers, and optionally let you send on a second session while another stream finishes in the background.

## Submission checklist

1. Prepare your response — this document, “What I built”
2. Explain your process — this document, “How I approached it”
3. Solution link — GitHub repository URL (after push)
4. Upload project files — ZIP of the repo excluding `node_modules/`, `dist/`, and `.env`

Setup and run instructions are also in [README.md](./README.md).

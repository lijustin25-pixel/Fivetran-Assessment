# AI Chat Assessment — Response & Process

This document covers the submission checklist items for preparing a clear response and explaining the how/why behind the implementation.

---

## 1. Prepared response (what was built)

### Goal

Build a functional web app where a user can send prompts to a generative AI API and see responses update in the UI without a page reload—including loading states, error handling, and component-based structure.

### Delivered requirements

| Requirement | Implementation |
|-------------|----------------|
| Text input + submit | Composer with accessible label, Enter to send, Shift+Enter for newline |
| Generative AI API | OpenAI Chat Completions (`gpt-4o-mini` by default) |
| Dynamic rendering | React state updates; no full-page reload |
| Loading states | Typing indicator before first token; streaming caret; Stop to cancel |
| Error handling | Empty prompt validation; missing key; timeout; network; 401/429/5xx |
| Component architecture | Feature-sliced React components under `src/features/chat/` |
| Semantic HTML | `aside`, `main`, `header`, `footer`, `form`, `label`, `article`, dialog roles |
| Responsive CSS | Desktop sidebar + mobile drawer; separate scroll regions |

### Bonus features

| Bonus | Implementation |
|-------|----------------|
| Persistent history | Multi-session LocalStorage (`fivetran-chat-sessions`); sidebar lists chat titles |
| Session management | New chat, Clear chat, Delete chat (with confirmation) |
| Markdown | `react-markdown` for assistant replies |
| Unit tests | Vitest + Testing Library (domain, gateway/SSE, storage, ChatInput) |
| Streaming | SSE (`stream: true`) so tokens appear as they arrive |

### Stack

- Vite + React 19 + TypeScript  
- Plain CSS (ChatGPT-inspired layout, neutral **AI Chat** branding)  
- OpenAI via `fetch` (no SDK)  
- Vitest / Testing Library / Oxlint  

### How to run

```bash
npm install
cp .env.example .env   # set VITE_OPENAI_API_KEY
npm run dev
npm test
npm run build
```

---

## 2. Process explanation (how and why)

### Step 1 — Clarify constraints before coding

The brief allows OpenAI, Hugging Face, or Anthropic. OpenAI was chosen because:

1. **Chat Completions** maps directly to a multi-turn UI (`messages[]` with `user` / `assistant`).
2. Streaming is first-class (`stream: true` + SSE), which matches modern chat UX.
3. Model quality for a demo is predictable with `gpt-4o-mini` (cost-efficient, sufficient for assessment).

Tradeoff accepted: a Vite `VITE_*` key is exposed in the browser. That is fine for a take-home with no backend; production would proxy through a server.

### Step 2 — Structure for clarity, not ceremony

The app started as a Vite scaffold. It was reorganized into a feature-sliced layout so responsibilities stay obvious without inventing ports/adapters for one feature:

```
src/App.tsx                      → thin shell
src/features/chat/
  domain/                        → types + pure helpers (no I/O)
  application/useChat.ts         → screen orchestration
  infrastructure/                → OpenAI gateway, LocalStorage, error mapping
  ui/                            → ChatRoute + presentational components
  index.ts                       → public barrel
```

**Why this shape**

- UI components stay presentational (props in, events out).  
- Network and storage stay out of React components.  
- Domain rules (session create/clear/delete, history pairing) are pure and unit-testable.  
- Enough structure for clarity; not a full Clean Architecture ceremony.

### Step 3 — Core chat flow

1. User submits a prompt from `ChatInput`.  
2. `useChat` validates (reject empty/whitespace).  
3. User message + empty assistant placeholder are written to session state.  
4. `streamChatCompletion` calls OpenAI with prior turns + new user message.  
5. Each SSE delta appends to the assistant message **on the originating session id** (switching chats mid-stream does not steal tokens).  
6. Clear/delete of the streaming session aborts the in-flight request; intentional aborts do not show an error banner.  
7. On failure: map to a readable banner; keep partial text if any tokens arrived; remove empty assistant bubble if nothing streamed.  
8. Persist sessions to LocalStorage when not actively streaming (avoids thrashing mid-stream).

### Step 4 — History and sessions

A single flat message list was not enough for “New chat” without losing context. Sessions were introduced:

- Each session has `id`, `title`, `messages`, `updatedAt`.  
- Sidebar lists sessions (newest first).  
- **New chat** creates an empty session (no-op if already empty).  
- **Clear chat** empties the active session’s messages.  
- **Delete chat** removes a session after confirmation dialog.  
- Legacy single-array LocalStorage is migrated automatically.

**Why confirmation on delete:** delete is irreversible; clear is softer and stays one click in the header.

### Step 5 — UX decisions

- Layout inspired by common chat products (sidebar + centered transcript + bottom composer) without third-party branding.  
- Sidebar scroll and chat scroll are isolated (`100svh` shell, `overflow` on each pane).  
- Streaming UX: dots until first token, then a blinking caret.  
- Markdown only on assistant messages (user text stays plain).  

### Step 6 — Errors and resilience

| Case | Behavior |
|------|----------|
| Empty prompt | Client-side error; no API call |
| Missing API key | Setup guidance in banner |
| Timeout / network | Clear user-facing message |
| 401 / 429 / 5xx | Status-specific copy |
| Empty model output | Explicit empty-response error |

Errors do not wipe prior conversation history.

### Step 7 — Testing strategy

Tests focus on behavior that protects regressions:

- **Domain:** session start/clear/delete, history ordering, truncation, session-scoped deltas  
- **Gateway:** SSE line parsing, streamed deltas, HTTP/status error mapping  
- **Storage:** save/load, legacy migration, corrupt JSON  
- **useChat:** empty prompt, stream-after-session-switch, abort on clear/delete, error cleanup  
- **ChatInput / ConfirmDialog:** send rules; cancel-first focus + Tab trap + Escape  

UI chrome (CSS layout) is verified manually; logic is covered by unit tests (`npm test`).

### Step 8 — What I would do next in production

1. Backend proxy for the API key.  
2. Rate limiting and retry with backoff.  
3. Deployed preview URL for reviewers.  
4. Optional: allow sending on a second session while another stream finishes in the background.

---

## Architecture diagram

```
┌─────────────┐
│   App.tsx   │  thin shell
└──────┬──────┘
       ▼
┌─────────────┐     ┌──────────────────┐
│  ChatRoute  │────▶│ HistorySidebar   │
│  (ui)       │     │ MessageList      │
└──────┬──────┘     │ ChatInput        │
       │            │ ConfirmDialog    │
       ▼            └──────────────────┘
┌─────────────┐
│   useChat   │  application orchestration
└──────┬──────┘
       ├────────────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│ chatGateway │  │ chatStorage │
│ (OpenAI SSE)│  │ LocalStorage│
└─────────────┘  └─────────────┘
       ▲
       │ uses pure helpers
┌─────────────┐
│ domain/chat │
└─────────────┘
```

---

## Submission checklist mapping

| Checklist item | Where to find it |
|----------------|------------------|
| 1. Prepare your response | This document — Section 1 |
| 2. Explain your process | This document — Section 2 |
| 3. Solution link | GitHub repository URL (after push) |
| 4. Upload project files | ZIP of repo excluding `node_modules/`, `dist/`, and `.env` |

Setup and run instructions also live in [README.md](./README.md).

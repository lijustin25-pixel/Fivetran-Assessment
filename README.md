# AI Chat Assessment

A React + TypeScript chat interface that calls OpenAI’s Chat Completions API with token streaming, loading and error states, LocalStorage-backed history, Markdown rendering, and unit tests.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your env file from the example and add an OpenAI API key ([platform.openai.com/api-keys](https://platform.openai.com/api-keys)):

```bash
cp .env.example .env
```

```env
VITE_OPENAI_API_KEY=sk-your-key-here
# optional
# VITE_OPENAI_MODEL=gpt-4o-mini
```

3. Start the app:

```bash
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development server |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |
| `npm test` | Run unit tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with Oxlint |

## How it works

### Architecture

The app uses a feature-sliced layout under `src/features/chat/` so UI, orchestration, pure domain rules, and I/O stay separated:

| Layer | Path | Responsibility |
|-------|------|----------------|
| Shell | `src/App.tsx` | Thin wrapper that renders `ChatRoute` |
| UI | `features/chat/ui/` | Route screen + presentational components |
| Application | `features/chat/application/` | `useChat` orchestration hook |
| Domain | `features/chat/domain/` | Types, constants, pure helpers (no I/O) |
| Infrastructure | `features/chat/infrastructure/` | OpenAI gateway, LocalStorage adapter, error mapping |

Public exports go through `features/chat/index.ts`. Dependency direction is UI → application → domain / infrastructure.

```
App → ChatRoute → useChat → chatGateway → OpenAI API
                      ↓
                 chatStorage (localStorage)
                      ↓
                 MessageList / Markdown
```

### Why OpenAI Chat Completions

Chat Completions accepts a `messages[]` history with `user` / `assistant` roles, which maps cleanly onto a multi-turn UI. Responses use `stream: true` (SSE) so tokens render as they arrive. `gpt-4o-mini` is the default model for cost-efficient demos; override with `VITE_OPENAI_MODEL` if needed.

### Loading and errors

- Empty / whitespace prompts never hit the network; the UI surfaces a validation error.
- While streaming, the input is disabled, a typing indicator shows until the first token, then a caret follows the growing reply. **Stop** cancels the in-flight request and keeps any partial text.
- Failures (missing key, timeout, network, 401 / 429 / 5xx, empty model output) map to readable messages in a dismissible banner. Partial streamed text is kept when available.
- Stream requests use a 120s `AbortSignal.timeout`.

### Persistent history and session reset

Chat sessions are saved under the LocalStorage key `fivetran-chat-sessions` and restored on load. The **History** sidebar lists past chats (title from the first prompt). **New Chat** starts a fresh thread without deleting older chats; **Clear chat** empties the active conversation; **Delete chat** removes a session from history (trash icon + confirmation). Legacy single-thread history (`fivetran-chat-history`) is migrated automatically.

### Markdown

Assistant replies render through `react-markdown` so code blocks, lists, and inline formatting display correctly. User messages stay plain text.

### Security tradeoff

`VITE_*` variables are embedded in the client bundle. That is acceptable for this take-home so the app can run without a backend, but a production app should proxy OpenAI through a server so the key never reaches the browser.

## Submission notes

- **Prepared response & process write-up:** see [PROCESS.md](./PROCESS.md).
- **Solution link:** push this repository to GitHub and share the repo URL.
- **ZIP upload:** zip the project excluding `node_modules/`, `dist/`, and `.env` to stay under the 10MB limit.

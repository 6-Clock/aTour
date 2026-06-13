# aTour Frontend Guide — Vite + React + TypeScript

This guide explains how to use Vite to build the aTour frontend. aTour is a tour marketplace where tourists search and book experiences from local guides, powered by an AI search backend (Google Gemini).

---

## What is Vite?

Vite is the tool that runs your frontend during development and bundles it for production. Think of it as the engine under the hood — you don't write code inside Vite, but it:

- Starts a local web server so you can see your app in a browser
- Reloads the page instantly whenever you save a file (called **Hot Module Replacement, or HMR**)
- Compiles your TypeScript files into JavaScript the browser can understand
- Bundles everything into optimized files when you're ready to deploy

---

## Starting the Dev Server

```bash
cd frontend
npm install      # only needed the first time, or after pulling new changes
npm run dev
```

Vite will print something like:

```
  VITE v8.x.x  ready in 300 ms

  ➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173` in your browser. You'll see the starter page. Every time you save a file in `src/`, the browser updates automatically — no manual refresh needed.

---

## Understanding the Folder Structure

```
frontend/
├── index.html          ← The single HTML page. Vite injects your app here.
├── vite.config.ts      ← Vite configuration (currently minimal — good)
├── src/
│   ├── main.tsx        ← Entry point. Mounts the React app into index.html.
│   ├── App.tsx         ← Root component. This is where you'll build your pages.
│   ├── App.css         ← Styles for App.tsx
│   ├── index.css       ← Global styles (body font, resets, etc.)
│   └── assets/         ← Images and static files imported by components
└── public/             ← Files served as-is (favicon, icons). Not processed by Vite.
```

**The most important file to start with is `src/App.tsx`** — it's what your browser renders. Delete the placeholder content there and start building aTour's UI.

---

## How to Make Your First Change

1. Open `src/App.tsx`
2. Replace all the placeholder JSX with something simple to confirm everything works:

```tsx
function App() {
  return (
    <div>
      <h1>aTour</h1>
      <p>Find your perfect local experience.</p>
    </div>
  )
}

export default App
```

3. Save the file. The browser at `http://localhost:5173` updates instantly.

---

## Adding New Pages (Components)

aTour will need multiple views: a **home/search page**, a **listings page**, a **booking page**, etc. In React, each page is a component — a `.tsx` file inside `src/`.

**Example: creating a search page**

Create `src/pages/SearchPage.tsx`:

```tsx
function SearchPage() {
  return (
    <div>
      <h1>Find an Experience</h1>
      <input type="text" placeholder="e.g. street food walk under $30" />
    </div>
  )
}

export default SearchPage
```

Then import and use it in `App.tsx`:

```tsx
import SearchPage from './pages/SearchPage'

function App() {
  return <SearchPage />
}

export default App
```

As aTour grows, you'll want a router (like **React Router**) so different URLs show different pages. That's a next step — for now, swap components in `App.tsx` manually to work on each page.

---

## Connecting to the Backend API

The backend runs at `http://localhost:8000`. From your React components, use the browser's built-in `fetch` to call it.

**Example: calling the AI search endpoint**

```tsx
async function searchExperiences(query: string) {
  const response = await fetch('http://localhost:8000/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data = await response.json()
  return data
}
```

> The backend must be running (`uvicorn main:app --reload --port 8000`) for these calls to work. If you see a network error in the browser console, check that the backend is up.

### Avoiding CORS errors

When your browser (running on port 5173) calls the backend (port 8000), the browser's security policy blocks it unless the backend explicitly allows it. This is called a **CORS error** and you'll likely hit it early.

Fix it in `vite.config.ts` by proxying API calls through Vite's dev server:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

With this in place, call `/api/search` from your React code instead of the full `http://localhost:8000/search` URL. Vite forwards those requests to the backend for you, and the CORS error disappears.

---

## Environment Variables

If you need to store an API base URL or any config that differs between development and production, use a `.env` file inside the `frontend/` folder.

```
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000
```

**Important:** Vite only exposes variables that start with `VITE_` to your React code. Access them like this:

```tsx
const apiUrl = import.meta.env.VITE_API_BASE_URL
```

Never put secret keys here — this file's values are embedded into the JavaScript bundle and visible to anyone who opens your site.

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the dev server with HMR at `localhost:5173` |
| `npm run build` | Compile + bundle everything into `dist/` for deployment |
| `npm run preview` | Locally preview the production build (run `build` first) |
| `npm run lint` | Check your code for common mistakes using ESLint |

---

## TypeScript Basics for This Project

The frontend uses TypeScript (`.tsx` files). You don't need to master it, but here are the two things you'll use most:

**Typing props** — when you pass data into a component, describe its shape:

```tsx
type ExperienceCardProps = {
  title: string
  price: number
  guide: string
}

function ExperienceCard({ title, price, guide }: ExperienceCardProps) {
  return (
    <div>
      <h2>{title}</h2>
      <p>Guide: {guide} — ${price}</p>
    </div>
  )
}
```

**Typing API responses** — describe what the backend returns so TypeScript can catch mistakes:

```tsx
type Experience = {
  id: number
  title: string
  price: number
  duration_minutes: number
  category: string
}
```

If TypeScript shows a red underline, read the error — it almost always tells you exactly what's missing or mismatched.

---

## Suggested Build Order for aTour

Based on the project's features, here's a sensible order to build the frontend:

1. **Search page** — text input that calls `POST /search` and shows a list of experiences (most visible feature; uses AI immediately)
2. **Experience card component** — reusable card showing title, price, duration, guide name, category
3. **Experience detail page** — full listing view with a "Book" button
4. **Auth pages** — sign up / log in for both tourists and guides
5. **Guide dashboard** — form to create/edit listings and manage availability
6. **Booking flow** — date picker, confirmation screen
7. **Review form** — post-booking star rating + text

Start with #1 so you can see the AI search working end-to-end early.

---

## Quick Troubleshooting

**Port already in use**
If `npm run dev` says port 5173 is taken, another Vite instance is already running. Close it or run `npx kill-port 5173` (Windows: `npx kill-port 5173`).

**Changes not showing up**
Hard-refresh the browser (`Ctrl+Shift+R`) or stop and restart `npm run dev`.

**TypeScript error on `import.meta.env`**
Add `/// <reference types="vite/client" />` at the top of `src/vite-env.d.ts` (Vite generates this file automatically — check it exists).

**Can't reach the backend**
Confirm the backend is running: open `http://localhost:8000/docs` in a separate tab. If that doesn't load, start the backend first.

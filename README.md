# CloudSync

Real-time collaborative document editing powered by CRDTs, built with Next.js, TipTap, Yjs, and Supabase.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Editor & CRDT Sync:** TipTap, Yjs, `y-indexeddb`, `y-websocket`
- **Backend & Auth:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **Testing:** Vitest

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` in the project root and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_YJS_WS_URL=ws://localhost:1234
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

You can find your Supabase URL and keys in **Supabase Dashboard → Project Settings → API**.

### 3. Set up the database

Run [`supabase/schema.sql`](./supabase/schema.sql) in **Supabase Dashboard → SQL Editor → New Query**.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` — Start the Next.js development server
- `npm run build` — Build for production
- `npm run start` — Start the production server
- `npm run lint` — Run ESLint
- `npm test` — Run tests with Vitest
- `npm run test:watch` — Run Vitest in watch mode

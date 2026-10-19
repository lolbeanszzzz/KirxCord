# KirxCord

A Discord-style chat app: servers with roles, channels, webhooks and invites; DMs; typing indicators; file, GIF (Tenor) and link messages; avatars and banners (.jpg, .webp, animated .gif).

Stack: React + Vite + TypeScript on the client, Supabase (Postgres, RLS, Realtime, Storage) on the backend. Accounts use a nickname plus a 4–6 digit PIN, hashed in the database.

## 1. Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it. This creates the tables, PIN auth functions, RLS policies, and the public `media` storage bucket. Live updates use Supabase Realtime broadcast, so no table publication is needed.
3. Copy the project URL and anon key from **Settings → API**.

## 2. Environment

```bash
cp .env.example .env.local
```

Fill in:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- `VITE_TENOR_API_KEY` (optional; the GIF picker is disabled without it)

## 3. Run

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build into dist/
```

## Notes

- Permissions are enforced in Postgres (RLS and `has_perm`), not only in the UI.
- Webhooks: `POST {SUPABASE_URL}/rest/v1/rpc/execute_webhook` with JSON `{ "p_token": "<token>", "p_content": "text" }` and the anon key header. Tokens are shown in server settings.
- Uploads go to the `media` bucket under `<user id>/…`; uploads are limited to your own folder.
- This is a foundational pass. There is no end-to-end encryption, and PINs are not recoverable.

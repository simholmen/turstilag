# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Database (Supabase migrations)

The schema lives in `supabase/migrations/`, one timestamped SQL file per change, applied in order.
Never edit a migration that has already been pushed; add a new one instead.

```sh
npm run db:new -- add_trail_slug   # creates supabase/migrations/<timestamp>_add_trail_slug.sql
npm run db:start                   # local Supabase in Docker
npm run db:reset                   # rebuild local DB from migrations + supabase/seed.sql
npm run db:push                    # apply pending migrations to the linked project
```

One-time setup against the hosted project: `npx supabase login`, then `npx supabase link --project-ref <ref>`.

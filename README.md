# B'Seder

Jewish life planner with goals, a calendar, zmanim, and a minyan finder.
Built with Next.js 15, React 19, Auth.js, Prisma 5, and MySQL.

## Local setup

Use Node.js 24 LTS and npm.

```sh
npm ci
cp .env.example .env
```

Set `DATABASE_URL`, generate `AUTH_SECRET`, and set `AUTH_URL` to the app's
public origin. Google sign-in and password reset emails additionally require
their credentials in `.env.example`. Use a verified sender for `RESEND_FROM`.
Behind a trusted reverse proxy, enable `AUTH_TRUST_HOST` as required by Auth.js.

Apply the checked-in database migrations to the intended MySQL database, then
start development:

```sh
npx prisma migrate deploy
npm run dev
```

## Validation and production

```sh
npm run typecheck
npm run test:unit
npm run build
npm start
```

The build regenerates Prisma Client from the current schema before compiling.
It can run without production credentials or a live database; configure those
at runtime. Database migrations are a separate deployment step.

Development and production output use `.next-dev` and `.next-prod` respectively.
Use `npm start` with the output from `npm run build`. Standalone typechecking
excludes these generated directories so stale route types do not affect it.
GitHub Actions runs typechecking, unit tests, and the production build on pushes
and pull requests.

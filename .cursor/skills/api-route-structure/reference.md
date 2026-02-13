# API Route Structure — Reference

Route-first layout: main route `/api`, one folder per sub-route, endpoints in `routes.ts` (no folder per endpoint).

### File responsibilities

| File path | Purpose | Description |
|-----------|---------|-------------|
| `src/index.ts` | **App entry** | Mounts the API router at `/`. |
| `src/api/index.ts` | **API entry** | Sets `basePath("/api")` and mounts each sub-route with `api.route("/...", ...Router)`. |
| `src/api/[sub-route]/index.ts` | **Sub-route entry** | Creates the Hono router, registers routes from `routes.ts`, exports the router. |
| `src/api/[sub-route]/routes.ts` | **HTTP + OpenAPI** | Defines endpoints with `createRoute`. Handlers parse request, call services, return response. All sub-sub routes for this path live here. |
| `src/api/[sub-route]/schema.ts` | **Shapes** | Zod schemas for request/response and shared types. Single source of truth for validation and types. |
| `src/api/[sub-route]/services.ts` | **Business logic** | Pure functions: DB, external APIs. No Hono, no HTTP. Default: one file. Optional: `services/` folder when splitting many modules. |
| `src/utils/` | **Shared** | Cross-cutting code (auth, DB clients, etc.) used by multiple sub-routes. |

### Route hierarchy

- **Main route:** `/api` (one base path).
- **Sub-route:** One folder per first path segment → `/api/leaderboard`, `/api/auth`.
- **Sub-sub route:** One `createRoute` per endpoint in that sub-route’s `routes.ts` (e.g. `/api/leaderboard/mindshare`). Do not create a folder per endpoint. **Rare:** For an extremely complex sub-route, nested sub-folders (e.g. `leaderboard/mindshare/`) are allowed. Each nested folder has the **same layout** as a sub-route: `index.ts`, `routes.ts`, `schema.ts`, `services.ts`; mount each from the parent sub-route’s `index.ts`. Prefer one `routes.ts` until complexity justifies it.

### Example folder structure

```
src/
├── index.ts                 # app.route('/', api)
└── api/
    ├── index.ts              # basePath("/api"), api.route("/leaderboard", ...)
    ├── leaderboard/          # sub-route: /api/leaderboard
    │   ├── index.ts          # leaderboardRouter, openapi(...)
    │   ├── routes.ts         # /mindshare, /last-week-winners, etc.
    │   ├── schema.ts         # Zod schemas
    │   └── services.ts       # getMindshareLeaderboard, getLastWeekWinners, ...
    └── auth/                 # sub-route with optional services/ folder
        ├── index.ts
        ├── routes.ts
        ├── schema.ts
        └── services/
            ├── index.ts      # re-exports or main logic
            └── rbac.ts       # extra module when needed
```

### Development workflow

1. **Schema:** Define request/response shapes in `schema.ts`.
2. **Services:** Implement business logic in `services.ts` (or `services/` when split).
3. **Routes:** In `routes.ts`, add `createRoute` for each endpoint; handlers call services and use schema.
4. **Register:** In the sub-route’s `index.ts`, `openapi(route, route.handler)` for each route. In `src/api/index.ts`, `api.route("/<sub-route>", <subRoute>Router)`.

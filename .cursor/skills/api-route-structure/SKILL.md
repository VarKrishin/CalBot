---
name: api-route-structure
description: Structures Hono API by main route (/api) and sub-routes (one folder per path segment), with index, routes, schema, and services per sub-route. Use when adding new API endpoints, new sub-routes, or when structuring or refactoring backend API code.
---

# API Route Structure (Hono)

Use this layout for all API development so the codebase stays consistent and production-grade.

## Route hierarchy

- **Main route**: `/api` (single base path).
- **Sub-routes**: One folder per first path segment → `/api/leaderboard`, `/api/auth`, `/api/points`, etc.
- **Sub-sub routes**: Individual endpoints live **inside** that folder in `routes.ts` (e.g. `/api/leaderboard/mindshare`, `/api/leaderboard/last-week-winners`). Do **not** create a new folder per endpoint. **Optional (rare):** Only for an extremely complex sub-route (many endpoints, many owners), you may add nested sub-folders inside the sub-route (e.g. `leaderboard/mindshare/`, `leaderboard/weekly-winners/`). Each nested folder uses the **same layout** as a sub-route: `index.ts`, `routes.ts`, `schema.ts`, `services.ts`. Mount each nested router from the parent sub-route’s `index.ts` (e.g. `leaderboardRouter.route("/mindshare", mindshareRouter)`). Prefer a single `routes.ts` until complexity clearly justifies it.

## Folder layout per sub-route

Each sub-route folder (e.g. `src/api/leaderboard/`) contains:

| File        | Role |
|-------------|------|
| `index.ts`  | Create the Hono router and register route definitions from `routes.ts`. Export the router. |
| `routes.ts` | Define OpenAPI routes with `createRoute`, wire schema + handlers, call services. All endpoints for this sub-route live here. |
| `schema.ts` | Zod schemas for request/response and shared types. Export what `routes.ts` and `services.ts` need. |
| `services.ts` | Business logic, DB, external APIs. No HTTP; pure functions. |

**Optional:** If a sub-route has many service modules, split into a `services/` folder with `index.ts` (re-exports or main logic) plus extra files (e.g. `auth/services/rbac.ts`). Routes keep importing from `./services`. Prefer a single `services.ts` until the file is large or clearly separate concerns appear.

## 1. Mounting: main route and sub-routes

**App entry** (`src/index.ts`): mount the API router at root.

```ts
import { api } from './api'
const app = new OpenAPIHono()
app.route('/', api)
```

**API router** (`src/api/index.ts`): set base path and mount each sub-route.

```ts
import { leaderboardRouter } from "./leaderboard";

export const api = new OpenAPIHono().basePath("/api");
api.route("/leaderboard", leaderboardRouter);
// api.route("/auth", authRouter);
// ...
```

Result: `/api` is main route, `/api/leaderboard` is a sub-route.

## 2. Sub-route: index.ts

Create router and register each route from `routes.ts`. Keep this file thin.

```ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { RegExpRouter } from "hono/router/reg-exp-router";
import { getItemRoute, listItemsRoute } from "./routes";

export const myFeatureRouter = new OpenAPIHono({
  router: new RegExpRouter(),
});

myFeatureRouter.openapi(getItemRoute, getItemRoute.handler);
myFeatureRouter.openapi(listItemsRoute, listItemsRoute.handler);
```

## 3. Sub-route: schema.ts

Define Zod schemas; export what routes and services need.

```ts
import { z } from "zod";

export const ErrorResponseSchema = z.object({
  message: z.string(),
  error: z.string().optional(),
});

export const ItemRequestSchema = z.object({
  id: z.string(),
});
export const ItemResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});
```

## 4. Sub-route: routes.ts

Define OpenAPI routes with `createRoute`. Parse request, call service, return response. One route object per endpoint (sub-sub route).

```ts
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { getItem } from "./services";
import { ItemRequestSchema, ItemResponseSchema, ErrorResponseSchema } from "./schema";
import type { Context } from "hono";

export const getItemRoute = createRoute({
  method: "get",
  path: "/:id",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: ItemResponseSchema } } },
    500: { content: { "application/json": { schema: ErrorResponseSchema } } },
  },
  handler: async (c: Context) => {
    try {
      const { id } = c.req.param();
      const result = await getItem(id);
      return c.json(result, 200);
    } catch (error) {
      return c.json({ message: "Internal server error", error: String(error) }, 500);
    }
  },
});
```

## 5. Sub-route: services.ts (or services/)

Default: one **`services.ts`** file per sub-route. Business logic only: no Hono, no `c.req`/`c.json`. Accept plain inputs and return plain data.

When a sub-route has multiple service modules, split into a **`services/`** folder (e.g. `services/index.ts`, `services/rbac.ts`). Routes still `import { ... } from "./services"`. Prefer a single file until it gets large or concerns are clearly separate.

```ts
import { getCollection } from "@/db/mongo/mongodb";

export const getItem = async (id: string) => {
  const { collection } = await getCollection("items");
  const doc = await collection.findOne({ id });
  if (!doc) throw new Error("Not found");
  return { id: doc.id, name: doc.name };
};
```

## When to add what

- **New endpoint under an existing sub-route** (e.g. new `/api/leaderboard/...` path): add a new `createRoute` in that sub-route’s `routes.ts`, register it in that sub-route’s `index.ts`. Add schema in `schema.ts` and logic in `services.ts` as needed.
- **New first-level path under `/api`** (e.g. `/api/reports`): add a new sub-route folder `src/api/reports/` with `index.ts`, `routes.ts`, `schema.ts`, `services.ts`, then in `src/api/index.ts` add `api.route("/reports", reportsRouter)`.

## Checklist: new sub-route

1. Create folder `src/api/<sub-route>/`.
2. Add `schema.ts`: Zod schemas and exports.
3. Add `services.ts`: business logic functions.
4. Add `routes.ts`: `createRoute` for each endpoint; handlers call services and use schema.
5. Add `index.ts`: create OpenAPIHono, `openapi(route, route.handler)` for each route, export router.
6. In `src/api/index.ts`: `import { <subRoute>Router } from "./<sub-route>"` and `api.route("/<sub-route>", <subRoute>Router)`.

## Reference

- For file roles, route hierarchy, folder structure, and workflow, see [reference.md](reference.md).
- In-repo example: `src/api/leaderboard/` (index, routes, schema, services). Use it as the template for new sub-routes.

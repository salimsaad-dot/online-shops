# Online Shops — System Document

> **Read this first.** This file is the single source of truth for the project: what it is, every
> decision made and why, the architecture, and exactly where work stopped. Any developer or AI agent
> should be able to continue from here without asking the owner to re-explain.
>
> **Rule for whoever works on this:** update the *Progress log* and *Milestones* checkboxes at the end
> of every work session, and record any new decision in *Decisions*.

---

## 1. What we are building

A **multi-tenant e-commerce platform**: one codebase and one deployment that runs many independent
online shops for different clients. The owner (an agency/freelancer) onboards a new client by
creating a shop in a super-admin panel and pointing the client's domain at the platform — no new
deployment per client.

It replaces an older single-shop system, **ShopZone** (live as *Baaba Hanson*, `baabahanson.com`),
kept for reference in `../shopzone-main/` (Express + MongoDB backend, vanilla HTML frontend).
Baaba Hanson becomes the first tenant, and its MongoDB data will be migrated.

### Features carried over from ShopZone
- Storefront: home (featured + best sellers), product catalogue with search & category filter,
  product page, cart (browser-stored), checkout with **pickup or delivery**, order confirmation.
- Help center: customers send messages to the shop and later view replies.
- Shop admin: login, dashboard stats, products CRUD with image upload, orders list + status
  updates, messages inbox with replies, store settings (delivery/pickup, delivery fee), change password.

### Bugs in ShopZone that the rebuild must fix
| # | ShopZone problem | Fix in the new system |
|---|---|---|
| 1 | Admin "change password" called `PUT /api/auth/update`, which didn't exist | Real `PUT /api/auth/password` (requires current password, invalidates old sessions) |
| 2 | Order item prices came from the browser (customer could set price 0) | Server loads prices from DB; client sends only `productId` + `quantity` |
| 3 | Stock never decremented or checked | Atomic conditional decrement inside the order transaction; cancel restores stock |
| 4 | Order number = count of orders + 1 (race conditions, duplicates) | Per-shop counter `Shop.nextOrderNumber`, incremented inside the transaction |
| 5 | Anyone could read support replies by phone number alone | Lookup requires phone **and** a random message reference code |
| 6 | Open `/api/auth/setup` route; leaked error details | No setup route; super admin created by CLI script; generic 500s |
| 7 | API URL hard-coded in 8 files | Single env var on the frontend; same-origin `/api` proxy |
| 8 | Settings update accepted any field (`Object.assign(req.body)`) | Zod schema whitelist on every endpoint |

---

## 2. Decisions (with reasons)

| Decision | Choice | Why |
|---|---|---|
| Tenancy model | **One platform, many shops** (option B). `shopId` on every tenant table | Onboarding a client ≈ 5 min; fixes ship once for all clients; fixed hosting cost |
| Frontend | **Next.js 16 (App Router) + React 19 + Tailwind CSS 4**, TypeScript | Owner's chosen stack; server rendering gives SEO for product pages |
| Backend | **Node.js + Express 5**, TypeScript | Owner's chosen stack |
| Database | **MySQL** via **Prisma 7** ORM (MariaDB driver adapter) | Owner's choice; Prisma gives migrations + typed queries. Adapter works with MariaDB (local) and MySQL 8 (Aiven) |
| Validation | **Zod 4** on every request body/query | Fixes bug #8 class of issues |
| Money | Integers in **minor units** (pesewas/cents); currency per shop (default `GHS`) | No floating-point rounding errors |
| Auth | JWT in an **httpOnly cookie** (`os_token`), roles `SUPER_ADMIN` / `OWNER` / `STAFF`; `tokenVersion` for revocation | Safer than localStorage; cookie is first-party because frontend proxies `/api` |
| Frontend ↔ backend | Browser calls same-origin `/api/*`; Next.js **proxy/middleware rewrites** it to the backend and adds header `x-shop-host` | Cookies work on any client domain; backend knows which shop |
| Tenant resolution (backend) | `x-shop-host` → `ShopDomain.host` match → else `<slug>.<PLATFORM_DOMAIN>` → else `DEFAULT_SHOP_SLUG` (dev only) | Supports custom domains and free subdomains |
| Admin location | Shop admin at `<shop-host>/admin`; super-admin at `PLATFORM_HOST/platform` | Each client logs in on their own domain |
| Images | **Cloudinary**, folder `online-shops/<shopSlug>/` | Already used by ShopZone; works on Render (no persistent disk) |
| Customer accounts | Guest checkout stays default; **optional** customer accounts added in Phase 2 (order history, saved addresses) | Guest checkout converts best; accounts are a bonus — owner left this to us |
| Payments | Phase 2: **Paystack** (cards + Mobile Money, Ghana), pay-on-delivery kept as option | Owner said yes to online payments; Ghana market |
| Work order | Phase 1 = parity + multi-tenant + fixes; Phase 2 = payments + new features | Agreed with owner |
| Prisma version | **Pinned to 7.10.1** (npm `latest` tag points at 8.0.0-rc — do not upgrade until 8 is stable) | Avoid release-candidate breakage |
| Phone matching | Order tracking / message lookup compare the **last 9 digits** (`samePhone` in `lib/util.ts`) | `+233 24 111 2222` and `0241112222` are the same customer; still needs order number / reference |
| Auth scope | Shop users can only log in on their shop's host; the super admin only on `PLATFORM_HOST` | A leaked shop password can't reach the platform, and vice versa |
| Order status rules | `PENDING ⇄ READY → DELIVERED` (delivery orders) or `PICKED_UP` (pickup orders); `CANCELLED` is final and returns stock | Prevents inconsistent stock / impossible states |
| Store settings | Stored as columns on `Shop` (no separate Settings table) | Exactly one settings row per shop anyway |
| Next.js `cacheComponents` | **Off** (scaffold had it on) — pages render per request | Every page depends on the request host (which shop); the static-shell model would force `<Suspense>`/`use cache` everywhere for no gain. Revisit for performance later |
| `/api` proxy | Route Handler `src/app/api/[...path]/route.ts` (not `proxy.ts` rewrites) | Explicit control of forwarded headers (cookie, `x-shop-host`, client IP) and `Set-Cookie` passthrough |
| `src/proxy.ts` (Next 16's "middleware") | Platform host only serves `/platform/*`; shop hosts never serve `/platform` | Keeps the super-admin panel off client domains |
| **Storefront design direction (owner's choice, 2026-11-06, supersedes the row below)** | **"Premium & cinematic"**: dark full-bleed `CinemaHero` (featured products over an ambient blurred copy of their own photo), Instrument Serif display headlines (`.display`) with Inter for the interface, `.theme-premium` stone ramp + `--night` dark sections. Pill buttons, softer cards and fields via the theme shape tokens `--radius-btn/-field/-card` (admin and platform keep compact values). Swipeable `Rail`s, `Reveal` fade-ups, borderless 4:5 `ProductCard` with quick-add, sticky info column and a phone "Add to cart" bar on the product page. All motion respects reduced motion. The receipt signature (`OrderTicket`) is kept | The owner wanted the shop to "wow customers". Lifestyle shots and plain packshots both look good in the hero |
| ~~Storefront design direction (unslop audit, approved by owner 2026-11-06)~~ *(superseded above)* | "Warm, direct, dependable — a well-kept neighbourhood shop". Warm neutral ramp on the storefront only (`.theme-warm` in `globals.css`); admin/platform stay graphite. Colour comes from the shop's **product photos** (hero "shelf" of 3 in-stock product images) and the brand colour is used sparingly (primary actions, selection). Signature: **receipt** — order numbers as a mono ticket stub (`OrderTicket`), dashed tear lines, tabular figures on prices only | Removes the "AI template" look every client shop would inherit. Skill: `.claude/skills/unslop/` (CC BY 4.0, credit Damir Sokolovsky) |
| Colour tokens | Use `bg-paper / bg-surface / bg-raised / text-ink / text-ink-2 / text-ink-3 / border-line / border-line-strong / bg-brand / bg-night` — **not** raw `gray-*` in storefront code. Brand as text = `text-brand-ink` | Lets each area tint its neutrals; keeps one system |
| Default brand colour | **Forest green `#1f6b4f`** (was indigo `#4f46e5`, a classic AI default). Shops still on indigo were migrated | Owner's choice; white text contrast 6.4:1 |
| Icons / type | lucide-react (16px, stroke 1.5, muted colour); no emoji in UI. Inter + IBM Plex Mono (order numbers/codes). Headings weight 500, no bold 700 | One icon set; hierarchy from size not weight |
| Product listing order | In-stock products first, sold-out after (each group in the chosen sort), paginated as one list; "You may also like" shows in-stock only | Owner's choice — sold-out items were crowding the first row |
| Images on the frontend | Plain `<img>` (not `next/image`); `eager` for above-the-fold (hero shelf, main product photo), lazy elsewhere | Cloudinary already resizes; avoids Vercel image-optimisation quota and remote-host config per client |
| Image uploads | Resized in the browser to ≤1600px before upload (`lib/image-resize.ts`) | Vercel limits request bodies to 4.5 MB; also faster on mobile data. Later option: direct signed uploads to Cloudinary |
| Cart | `localStorage` key `cart:<shopSlug>`, refreshed from `GET /products?ids=` on the cart page | Prices/stock shown are fresh; server still recalculates at checkout |
| Client data fetching | Small `useData` hook (`lib/use-data.ts`), no React Query | Few dependencies; enough for admin pages |

### Environments
| | Local (now) | Production (later) |
|---|---|---|
| Database | XAMPP **MariaDB 10.4** on `localhost:3306`, user `root`, no password, DB `online_shops` | **Aiven** MySQL 8 |
| Backend | `http://localhost:4000` | **Render** web service |
| Frontend | `http://localhost:3001` (ports 3000/5000 are used by other apps on the owner's PC) | **Vercel** |
| Shop URLs | `http://<slug>.localhost:3001` (browsers resolve `*.localhost` to 127.0.0.1) | `<slug>.<platform-domain>` + custom domains |
| Platform admin | `http://localhost:3001/platform` | `https://app.<platform-domain>/platform` |

---

## 3. Repository layout

```
online-shops/
  system.md                 ← this file
  CLAUDE.md / AGENTS.md     ← pointers telling agents to read this file
  backend/                  Express API
    prisma/schema.prisma    DB schema (source of truth for tables)
    prisma.config.ts        Prisma 7 config (datasource URL, migrations path)
    src/
      index.ts              starts the server
      app.ts                express app: middleware + route mounting
      config/env.ts         Zod-validated environment variables
      lib/                  prisma client, cloudinary, errors, utils
      middleware/           tenant resolution, auth, validation, error handler
      modules/<area>/       routes + logic per area (auth, products, orders, ...)
      scripts/              CLI: create super admin, seed demo shop, migrate from ShopZone
      generated/prisma/     Prisma client output (generated, git-ignored)
  frontend/                 Next.js 16 app
    src/proxy.ts            host routing rules (platform vs shop hosts)
    src/app/api/[...path]/  same-origin proxy → backend (adds x-shop-host)
    src/app/(shop)/         storefront: / products products/[slug] cart checkout order-confirmed track help
    src/app/admin/          shop admin: login + (panel)/ dashboard orders products categories messages settings staff account
    src/app/platform/       super admin: login + (panel)/ shops list, shops/new, shops/[id], account
    src/components/ui/      Button, Field, Alert, Badge, ProductImg … (Tailwind only)
    src/components/shop/    ShopProvider (shop + cart + toasts), Header, Footer, ProductCard, OrderSummary …
    src/components/admin/   AdminShell, PlatformShell, ProductForm
    src/lib/                api.ts (browser), server-api.ts (server components), format.ts (money), types.ts, brand.ts
```

Branding: each shop's `primaryColor` is set as CSS var `--brand` on the layout; Tailwind exposes
`bg-brand`, `text-brand`, `text-brand-fg` etc. (`globals.css`).

> ⚠️ Next.js 16 has breaking changes vs older versions. Before writing frontend code read the docs in
> `frontend/node_modules/next/dist/docs/` (see `frontend/AGENTS.md`).

---

## 4. Data model (summary — see `backend/prisma/schema.prisma`)

- **Shop** — tenant. Branding (name, logo, colour, contact, WhatsApp), commerce settings (currency,
  pickup/delivery toggles, delivery fee), `orderPrefix` + `nextOrderNumber`.
- **ShopDomain** — custom hosts mapped to a shop.
- **User** — `SUPER_ADMIN` (shopId null) or `OWNER`/`STAFF` of one shop. Email globally unique.
- **Category**, **Product** (price in minor units, stock, isActive, slug unique per shop),
  **ProductImage** (multiple, ordered).
- **Order** (per-shop `orderNumber`, money snapshot + currency, status
  `PENDING → READY → DELIVERED | PICKED_UP`, or `CANCELLED`), **OrderItem** (name/price/image snapshot).
- **Message** (random `reference` code), **MessageReply**.

---

## 5. API (backend, all under `/api`) — ✅ implemented

Every request is resolved to a shop first (except `/api/platform/*`). The shop comes from the
`x-shop-host` header (the frontend proxy sets it to the browser's host). Money is always minor units.
Errors are `{ message, details? }` (`details` = Zod field errors on 400, or `{unavailable:[...]}` on stock 409).

Code map: storefront `modules/storefront/`, orders `modules/orders/`, messages `modules/messages/`,
auth `modules/auth/`, shop admin `modules/admin/*.admin.routes.ts`, platform `modules/platform/`.

**Public (storefront)**
- `GET  /shop` — public shop info + settings
- `GET  /categories`
- `GET  /products?search=&category=&sort=&page=&limit=` · `GET /products/best-sellers` · `GET /products/:slug`
- `POST /orders` — `{customer:{name,phone,email?}, items:[{productId,quantity}], deliveryType, deliveryAddress?, note?}`
- `GET  /orders/track?orderNumber=&phone=`
- `POST /messages` → returns `reference` · `GET /messages/lookup?reference=&phone=`

**Auth**
- `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `PUT /auth/password` · `PUT /auth/profile`

**Shop admin** (`/admin/*`, OWNER or STAFF of the resolved shop)
- `GET /admin/dashboard` — product/stock counts, orders by status, revenue (all-time, 30 days), unread messages, recent orders
- `GET|POST /admin/categories` · `PUT|DELETE /admin/categories/:id`
- `GET /admin/products?search=&categoryId=&status=all|active|inactive|low_stock|out_of_stock&page=` · `GET|PUT|DELETE /admin/products/:id` · `POST /admin/products` (JSON: name, description, price, stock, isActive, categoryId)
- images: `POST /admin/products/:id/images` (multipart field `images`, ≤8, ≤5 MB, jpg/png/webp → Cloudinary) · `POST /admin/products/:id/images/url` · `PUT /admin/products/:id/images/order {imageIds}` · `DELETE /admin/products/:id/images/:imageId`
- `GET /admin/orders?status=&deliveryType=&search=&page=` (+ `statusCounts`) · `GET /admin/orders/:id` · `PATCH /admin/orders/:id/status {status}`
- `GET /admin/messages?status=` (+ `unread`) · `PATCH /admin/messages/:id/read` · `POST /admin/messages/:id/reply {body}` · `DELETE /admin/messages/:id`
- OWNER only: `GET|PUT /admin/settings` · `POST /admin/settings/logo` (multipart `logo`) · `GET|POST /admin/staff` · `PUT|DELETE /admin/staff/:id`

**Platform** (`/platform/*`, SUPER_ADMIN, only on `PLATFORM_HOST`)
- `GET /platform/stats` · `GET|POST /platform/shops` · `GET|PUT /platform/shops/:id` (name, slug, isActive, currency)
- `POST /platform/shops/:id/domains {host}` · `DELETE /platform/shops/:id/domains/:domainId`
- `POST /platform/shops/:id/users` · `PUT /platform/shops/:id/users/:userId/password`

**Health:** `GET /health` (outside `/api`, for Render).

---

## 6. Milestones

### Phase 1 — Rebuild with fixes + multi-tenant
- [x] M0 Discovery: analyse ShopZone, list bugs, agree on stack and tenancy model
- [x] M1 Scaffolding: folders, git, backend deps, Next.js app, Prisma schema, first migration
- [x] M2 Backend core: env, Prisma client, tenant middleware, auth (cookie JWT, roles), error handling
- [x] M3 Backend modules: shop/settings, categories, products (+Cloudinary), orders (transaction, stock, numbering), messages, dashboard, staff
- [x] M4 Platform API + CLI: super-admin script, create shop + owner, domains, demo seed; smoke test (46 checks) passing
- [x] M5 Frontend foundation: host → shop proxy, API client, layout/branding, cart store
- [x] M6 Storefront pages: home, products, product, cart, checkout, confirmation, order tracking, help center
- [x] M7 Shop admin UI: login, dashboard, products (+images), categories, orders, messages, settings, staff, account/password
- [x] M8 Platform admin UI: shops list + stats, create shop + owner, shop detail (domains, users, activate/deactivate)
- [x] M9 Migrate Baaba Hanson data from MongoDB — script `npm run migrate:shopzone` done and verified locally.
      **Must be re-run against production (Aiven) at deploy time** with `--replace`, right before
      switching DNS, to capture orders placed in the meantime (see §7).
- [x] M10 Hardening: security review + fixes (§8), automated test suite `npm test` (31 tests)
- [ ] M11 Deploy: Aiven MySQL, Render backend, Vercel frontend, domains, docs

### Phase 2 — New features (all approved by owner)
- [ ] Online payments: Paystack (card + Mobile Money), webhooks, payment status on orders; keep pay-on-delivery
- [ ] Multiple images per product UI (schema already supports it)
- [ ] Product variants (size/colour with own price/stock)
- [ ] Discount codes (percentage/fixed, expiry, usage limits)
- [ ] Notifications: email, SMS, WhatsApp on new order / status change / message reply
- [ ] Per-shop branding & theming (logo, colours — partly in schema) and custom domains UI
- [ ] Optional customer accounts (order history, saved addresses)

### Future ideas (not yet approved)
- Reports/analytics export, inventory alerts, product reviews, SEO sitemap per shop, abandoned cart reminders.

---

## 7. How to run locally

1. Start **MySQL** in the XAMPP control panel. Create the DB once:
   `C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS online_shops CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`
2. **Backend** (`cd backend`):
   - copy `.env.example` → `.env` and set a random `JWT_SECRET` (already done on the owner's PC)
   - `npm install` (also runs `prisma generate`)
   - `npm run db:migrate` — apply migrations
   - `npm run db:seed` — demo shop + super admin (safe to re-run)
   - `npm run dev` — API on http://localhost:4000 (auto-restarts on change)
   - `npm test` — automated tests (Vitest). Starts the API in-process against the separate DB
     `online_shops_test` (created automatically; migrations applied with `migrate deploy`, tables
     emptied, demo seed loaded). Never touches `online_shops`; refuses DB names not ending in `_test`.
     Override with `TEST_DATABASE_URL`. Note: Prisma blocks `migrate reset` when run by an AI agent
     without the owner's explicit consent — the test setup deliberately doesn't use it.
3. **Frontend** (`cd frontend`): copy `.env.example` → `.env.local` (already done), `npm install`,
   `npm run dev` → http://localhost:3001 (or `npm run build && npm start` for production mode).
   Checks: `npm run typecheck`, `npm run lint`.
   - Storefront: http://demo.localhost:3001 · Shop admin: http://demo.localhost:3001/admin
   - Platform: http://localhost:3001 (redirects to /platform)
   - New shops are instantly at `http://<slug>.localhost:3001`.
   - Tip: for automated browser testing use the production build — in dev mode, headless Chromium
     sometimes clicks before hydration / crashes while Turbopack compiles a route.

**Local logins (from the seed — dev only):**
| Where | Email | Password |
|---|---|---|
| Platform admin — `http://localhost:3001/platform` | `admin@platform.local` | `admin12345` |
| Demo shop admin — `http://demo.localhost:3001/admin` | `owner@demo.local` | `owner12345` |

**Other backend scripts:** `npm run create-super-admin -- --email … --password …`,
`npm run create-shop -- --name … --slug … --owner-email … --owner-password … [--domain …] [--prefix BH]`,
`npm run db:studio` (DB browser), `npm run typecheck`, `npm run build` / `npm start` (production).

**Importing a ShopZone store (Baaba Hanson):** reads MongoDB read-only.
```
npm run migrate:shopzone -- --mongo-env ../../shopzone-main/backend/.env --slug baabahanson --dry-run
npm run migrate:shopzone -- --mongo-env ../../shopzone-main/backend/.env --slug baabahanson \
  --name "Baaba Hanson" --prefix ORD --owner-name "Baaba Hanson" \
  --owner-email <real owner email> --owner-password <temp password> \
  --domain baabahanson.com --domain www.baabahanson.com
# re-import later (wipes that shop's products/categories/orders/messages first):
npm run migrate:shopzone -- --mongo-env ../../shopzone-main/backend/.env --slug baabahanson --replace
```
Facts about the live ShopZone data (MongoDB Atlas, db `test`, read 2026-11-06): 4 products
(13 Cloudinary images in account `dx4falz4t`), 2 categories, 3 orders ORD-0001…0003 (all
completed; their products were since deleted, so items keep name/price snapshots only),
0 messages, settings currency **GHS** ₵, delivery on (free), pickup off. The **live site runs newer
code than `shopzone-main/`** (products have `images[]`/`imagePublicIds[]`, settings has
`currencyCode`) — the script handles both shapes. Completed orders whose status didn't match their
delivery type were normalised. The old admin account (username-based) is not migrated; a new owner
login is created instead.

Locally the shop is at http://baabahanson.localhost:3001 with placeholder owner
`owner@baabahanson.com` (temporary password was given to the owner in chat; reset it from the
platform panel → shop → Reset password if lost).

**Changing the schema:** edit `prisma/schema.prisma` → `npm run db:migrate -- --name <what-changed>` → commit the new folder in `prisma/migrations/`.
⚠️ **Windows gotcha:** XAMPP MariaDB has `lower_case_table_names=1`, so Prisma writes new migrations
with **lowercase** table names (e.g. ``ALTER TABLE `shop` ``). Aiven (Linux MySQL) is case-sensitive
and would fail. After generating a migration, fix names to match the models (`Shop`, `Order` …); if
it was already applied locally, update its checksum in `_prisma_migrations` (sha256 of the file).
Prisma also refuses `migrate reset` when run by an AI agent without the owner's explicit consent.

---

## 8. Security notes (review of 2026-11-06)

**Protections in place**
- Tenant isolation: every admin/storefront query filters by `shopId`; covered by tests (other
  shop's owner gets 404 on our orders/products, can't log in on our host, can't order our products).
- Auth: httpOnly `SameSite=Lax` cookie, host-only (one shop's session is never sent to another);
  `tokenVersion` revokes sessions on password change / disable / role change; login scoped by host;
  timing-safe login; super admin only on `PLATFORM_HOST`.
- CSRF defence in depth: `checkOrigin` (backend `middleware/security.ts`) rejects state-changing
  requests whose `Origin` host ≠ the shop host.
- Rate limits (production values; ×20 in dev): login 10/15 min, orders 20/10 min, order tracking
  30/10 min, messages 10/10 min, message lookup 30/10 min. Keyed on the real client IP, which the
  backend only accepts from the Next proxy via `x-client-ip` + **`INTERNAL_PROXY_SECRET`** (same
  value in `backend/.env` and `frontend/.env.local`; required in production). `trust proxy` = 1.
- Validation: Zod everywhere; URLs (logo, image links) must be `http(s)` (`httpUrl`) — plain
  `z.url()` accepts `javascript:`.
- Frontend headers (`next.config.ts`): nosniff, referrer policy, permissions policy; `/admin` and
  `/platform` send `X-Frame-Options: DENY` + `frame-ancestors 'none'`. API uses Helmet.
- `/api` proxy forwards only whitelisted headers and rejects `.`/`..` path segments.
- Dependency audit (production deps): 0 known vulnerabilities in both apps.

**Accepted risks / later work**
- Anyone can place fake pay-on-delivery orders that hold stock (rate-limited; staff can cancel to
  restore stock). Phase 2 online payments (reserve stock until paid) reduces this.
- Emails are globally unique: one person can't be staff in two shops, and adding an email used by
  another shop returns "already exists" (minor cross-tenant email enumeration for owners).
- Shop lookups are cached 30 s per server process — deactivating a shop takes up to 30 s.
- No CSP for the storefront yet (React escapes output; no user HTML is rendered).
- Migrated ShopZone messages (none currently) would get new reference codes customers don't know.

---

## 9. Progress log

Newest first. Each entry: date — what was done — what is next.

- **2026-11-06 (midday)**: **First commit, pushed to GitHub.**
  - Repo: https://github.com/salimsaad-dot/online-shops, branch `main`.
  - Added a root `.gitignore`. It keeps out the real `.env` files (only the `.env.example` templates are committed), `node_modules`, builds, the generated Prisma client and `.gstack/` (local audit screenshots/browser state).
  - A secret scan before committing found nothing.
  - Git identity is set in this repo only (same as Academia Hub).

- **2026-11-06 (late morning)**: **Storefront redesign "premium & cinematic", home page first (owner's choice; replaces the "warm neighbourhood shop" direction).**
  - Tokens: `.theme-premium` (stone ramp, `--night` for dark sections). Display font Instrument Serif (`.display`, `font-display`), Inter for the interface.
  - New components:
    - `CinemaHero`: dark full-bleed hero. Up to 4 featured products crossfade every 7s, over an ambient blurred copy of the photo, with thumbnail selectors and progress bars. It pauses on hover/focus and never auto-advances for reduced motion.
    - `Rail`: scroll-snap rows with arrows on desktop.
    - `Reveal`: fade-up on scroll; content is visible without JS.
    - `AddToCartButton`.
  - Rewritten:
    - Header: transparent over the hero, frosted glass on scroll, menu on phones, search in a panel.
    - `ProductCard`: borderless, 4:5 photo, round quick-add button.
    - Home page: hero → statement + service facts → category tiles → New in rail → dark Spotlight → best sellers → help card.
    - Footer: dark.
  - Backend: `GET /categories` now returns `imageUrl` (the newest in-stock product photo) for the category tiles.
  - Typecheck and lint are clean; checked in the browser on desktop and mobile (dev preview on port 3002).
  - **Approved by the owner ("wow, i like it")**, then rolled out across the storefront:
    - Product page: 4:5 gallery that crossfades between photos; sticky info column on desktop; pill stepper and buttons; a phone "Add to cart" bar that slides up once the main button scrolls away; "You may also like" as a `Rail`.
    - Product list: display heading, pill category chips (black when selected), pill pagination.
    - Cart, checkout, track, help and receipt: display headings and more spacing. The pill/soft shapes come from the theme tokens.
    - Storefront inputs are 16px (no iOS zoom).
  - 33 tests pass; typecheck and lint are clean; checked in the browser on desktop and mobile.
  - **To see it on port 3001:** stop `npm start`, then run `npm run build` and `npm start` again (the dev preview on 3002 already shows it).
  - **Next:** M11 deploy. Still open from the audit: F8 broken-image fallback; new products defaulting to stock 0.

- **2026-11-06 (morning)**: **UI audit, report only (no code changed).**
  - Covered the storefront (demo and Baaba Hanson), the shop admin and the platform panel, at desktop and mobile widths.
  - Report: `.gstack/design-reports/design-audit-online-shops-2026-11-06.md`, with screenshots alongside it. Design score B, AI-slop score A-.
  - Top issues:
    - Admin and platform tables are cut off on phones (status column hidden).
    - `readableOn()` threshold 0.45 gives unreadable white text on mid-bright brand colours (should be about 0.18).
    - Home best sellers include sold-out items.
    - The checkout field error doesn't clear after the field is fixed.
    - Red cancel and deactivate buttons are as loud as the primary actions.
    - Indigo leftovers on the platform panel.
  - The audit placed test order DEMO-0025 on the demo shop, then cancelled it (stock restored).
  - Note: there's no root `.gitignore`, so `.gstack/` would be committed by `git add .`.
  - **Fixes applied the same morning:**
    - Mobile card lists for admin Orders, Products and platform Shops.
    - Brand text colour: `readableOn()` now picks whichever contrasts more, and a new `--brand-ink` token (use `text-brand-ink`, never `text-brand`, for text).
    - Best sellers in stock only, in full rows of 4. New test; 33 tests pass.
    - Field errors clear on typing; checkout focuses the first invalid field.
    - Quieter `danger` button variant; "Shop status" section on the platform shop page.
    - WhatsApp is a secondary button on the receipt.
    - Indigo and purple removed.
    - "Sold out" badge in the admin product list.
    - Platform header fits on phones.
  - Verified with typecheck, lint, `next build` and in a browser.
  - Still open: F8 broken-image fallback, F9 tap targets, new-product stock defaulting to 0, polish items P1–P8 (see the report).
  - ⚠️ **Two copies of this project exist:**
    - `C:\Users\SDT\Desktop\e-commerce\online-shops`: the running dev servers on 3001/4000 come from here.
    - `C:\Users\SDT\Desktop\Academia_Hub\e-commerce\online-shops`: these fixes are only in this copy.

    **Decided by the owner (2026-11-06): the real copy is `Desktop\Academia_Hub\e-commerce\online-shops`.**
    - The old copy had nothing extra (`.env` files identical; the only differences were these fixes).
    - The old copy is no longer used: run servers from this copy only.
  - **Next:** M11 deploy.

- **2026-11-06 (late night)** — **Storefront "unslop" pass.** Installed the unslop design skill
  (`.claude/skills/unslop/`, reviewed its scripts first). Audit found light slop (purple default,
  emoji icons, flat colour-slab hero, accent on every button, `!` copy, bold headings, uppercase
  label, hover zoom, pill everything). Owner approved direction, forest-green default and
  in-stock-first. Applied all passes (see Decisions). Backend: migration
  `default_brand_forest_green` (fixed lowercase table name for Aiven, see §7), in-stock-first
  listing + test (32 tests pass). Verified in browser (desktop + mobile, checkout → receipt).
  Admin/platform panels not restyled yet (still have uppercase table headers) — optional follow-up.
  **Next:** M11 deploy.

- **2026-11-06 (night)** — **M10 done.** Security review → fixes: real-client-IP rate limiting with
  proxy secret (new env `INTERNAL_PROXY_SECRET` in both apps), rate limits on order tracking and
  message lookup, Origin check on state-changing requests, http(s)-only URL validation (found that
  `z.url()` accepted `javascript:`), proxy path guard, security/anti-framing headers. Replaced
  `tests/smoke.mjs` with Vitest suite (`npm test`, 31 tests incl. concurrency and tenant isolation)
  on its own `online_shops_test` DB. Re-verified in browser on a fresh production build.
  Details and accepted risks in §8. **Next:** M11 deploy (Aiven, Render, Vercel, domains).

- **2026-11-06 (later)** — **M9 done locally.** Wrote `src/scripts/migrate-shopzone.ts` (+ dev dep
  `mongodb@6`). Inspected live MongoDB read-only, dry-ran, imported into shop `baabahanson`
  (#13 locally), tested re-run guard and `--replace`, verified rows and the storefront in a browser
  (images load from Cloudinary, GH₵ prices, next order ORD-0004). Details in §7.
  **Next:** M10 hardening (security review, tests), then M11 deploy — which includes re-running the
  migration against Aiven with the owner's real email.

- **2026-11-06** — **Frontend complete for Phase 1 (M5–M8).** Next 16.4 app: storefront, shop admin
  and platform panel as listed in §3. `tsc` and `eslint` clean; `next build` succeeds. Verified in a
  headless browser against the production build: customer checkout (qty 2 + delivery fee → correct
  total, order DEMO-0005), order tracking, admin login → dashboard → order status change → create
  product (price stored as minor units), settings; platform login → create client shop → its
  subdomain storefront works immediately. Test shops/products were deleted afterwards; the demo
  shop keeps 5 sample orders. Backend gained `GET /products?ids=` (cart refresh). Login rate limit
  is 10/15 min in production but 200 in development (repeated testing hit the limit). Smoke test
  re-run: 46/46. Backend `tsconfig.json` uses `module`/`moduleResolution` **Node16** (the old
  `"Node"` value is deprecated in TypeScript 6, which VS Code bundles; output is still CommonJS).
  **Known gaps:** Cloudinary not configured locally (uploads return 503 — set `CLOUDINARY_*` in
  `backend/.env`); nothing committed to git yet (owner hasn't asked).
  **Next:** M9 (migrate Baaba Hanson from MongoDB), then M10 hardening and M11 deploy.

- **2026-11-05 (later)** — **Backend complete for Phase 1 (M1–M4).** Prisma pinned to 7.10.1 after
  an install mix-up pulled 8.0-rc. Migration `init` applied to XAMPP DB `online_shops`. All routes in
  §5 implemented; demo seed (68 ShopZone sample products, 8 categories) loaded. `tests/smoke.mjs`:
  46/46 checks pass, covering every ShopZone bug fix, concurrent ordering (no oversell, unique
  numbers) and tenant isolation. Added `samePhone` matching. Cloudinary env vars are empty locally —
  image *uploads* return 503 until set; image URLs (seed data) work.
  Frontend `npm install` failed during the outage and was re-run.
  **Next:** M5 — read `frontend/node_modules/next/dist/docs/` for Next 16 changes, then build the
  proxy (host → `x-shop-host`, `/api/*` → backend), API client, shop branding layout, cart.

- **2026-11-05** — Discovery done; decisions above agreed with owner. Created `online-shops/` (git
  initialised, nothing committed yet). Backend: runtime deps installed (Express 5.3, Prisma client
  7.10, MariaDB adapter, Zod 4.6, etc.); dev deps (TypeScript, tsx, Prisma CLI) being re-installed
  after an internet outage. Wrote `prisma/schema.prisma`, `src/config/env.ts`, `src/lib/errors.ts`,
  `src/lib/util.ts`. Frontend: scaffolded with create-next-app (Next 16.4.5, React 19.3, Tailwind 4).
  **Next:** finish M1 (prisma.config.ts, tsconfig, package scripts, .env/.env.example, first
  migration against XAMPP), then M2.

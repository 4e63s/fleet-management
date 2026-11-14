
```markdown
# Fleet Management System / نظام إدارة وتتبع الأسطول

Node.js (TypeScript) + Express + Socket.IO + PostgreSQL/Prisma, and React + Tailwind + Leaflet.

---

## Quick Start / التشغيل السريع

### 1) Database + API + UI with Docker
```bash
docker compose up --build
# (first run) seed the admin user and demo vehicles
docker compose exec backend npx tsx prisma/seed.ts   # or run `npm run seed` locally

```

### 2) Or Locally

```bash
cd backend && cp .env.example .env && npm install
npx prisma migrate dev --name init && npm run seed && npm run dev
cd ../frontend && cp .env.example .env && npm install && npm run dev

```

### 3) Fake Devices Streaming GPS + Health

```bash
cd backend && npm run simulate

```

Open [http://localhost:5173](http://localhost:5173) and sign in with `admin@fleet.local` / `Admin#12345` (change it immediately).

---

## Tests / الاختبارات

```bash
cd backend  && npm test            # unit + integration (no database needed, Prisma is mocked)
cd frontend && npm test

```

---

## Architecture / المعمارية

**Modular Monolith:** Every module (auth, vehicles, drivers, maintenance, telemetry, alerts, dashboard) receives its dependencies (Prisma, realtime bus) through factory functions. The WebSocket layer is hidden behind a `RealtimeBus` interface, so telemetry can be moved to its own service later (publish to Redis/NATS instead of Socket.IO) without touching the other modules. To run several API instances, add the Socket.IO Redis adapter.

الكود مقسّم إلى وحدات مستقلة تستقبل اعتمادياتها عبر دوال إنشاء (factories)، وطبقة WebSocket معزولة خلف واجهة `RealtimeBus`، فيمكن فصل خدمة التتبع لاحقًا إلى خدمة مستقلة دون تعديل بقية الوحدات.

---

## API Summary

| Method | Path | Access |
| --- | --- | --- |
| **POST** | `/api/auth/login`, `/refresh`, `/logout` | Public |
| **GET** | `/api/auth/me` | Any user |
| **POST** | `/api/auth/users` | ADMIN |
| **GET / POST / PATCH / DELETE** | `/api/vehicles`, `/api/drivers`, `/api/maintenance` | Read: Any; Write: ADMIN/MANAGER; Delete: ADMIN |
| **POST** | `/api/maintenance/:id/complete` | ADMIN/MANAGER |
| **GET / PATCH** | `/api/alerts`, `/api/alerts/:id/acknowledge` | Read: Any; Ack: ADMIN/MANAGER |
| **GET** | `/api/dashboard/summary` | Any user |
| **POST** | `/api/telemetry/position`, `/health` | Device key (`x-device-key`) |
| **GET** | `/api/telemetry/live`, `/health/overview`, `/vehicles/:id/positions`, `/vehicles/:id/health[/latest]` | Any user |

* **WebSocket (Socket.IO, auth: `{ token }`):** `position:update`, `health:update`, `alert:new`.

---

## Known Limits / ملاحظات

* Tokens are kept in `localStorage` in the SPA; for stricter XSS protection move the refresh token to an `httpOnly` cookie.
* Position/health tables grow quickly; add partitioning or a retention job (and TimescaleDB if volume is high).
* Tests mock Prisma. Add a Postgres-backed test suite (e.g. Testcontainers) before relying on query behaviour such as `mode: "insensitive"`.

---

## License & Copyright / حقوق النشر والترخيص

© 2026 **Aws Al-Harbi (4e63s)**. All rights reserved.

This repository and its source code are proprietary and confidential. Unauthorized copying, distribution, or modification of this project, via any medium, is strictly prohibited without explicit written permission from the copyright owner.

```

```

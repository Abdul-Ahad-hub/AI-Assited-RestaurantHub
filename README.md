# Restaurant Hub (with Smart AI Receptionist)

**Restaurant Hub** is a full-stack, role-based restaurant discovery, ordering, and commission-free marketplace platform powered by a **Text & Live Voice AI Concierge**.

It connects **Customers**, **Restaurant Owners**, and **Platform Administrators** with strict role isolation, transparent dynamic bidding for featured placement, and an authenticated AI assistant capable of browsing restaurants, answering menu questions, placing orders, and filling forms by voice.

---

## Architecture & Separation of Concerns

The application lives in [`AI Receptionist/`](./AI%20Receptionist) and is structured as a modular monolith with clear separation between UI presentation, client services, backend domain logic, and persistence:

```text
AI Receptionist/
├── App.tsx                         # Top-level role router, auth gate, and shared state orchestration
├── types.ts                        # Shared TypeScript domain models & DTOs
├── index.html                      # Entry HTML, fonts, and root mount
├── vite.config.ts                  # Vite + Express dev server middleware integration
├── styles/
│   └── theme.css                   # Responsive CSS classes, light/dark tokens, layout utilities
├── services/
│   ├── apiClient.ts                # Typed REST client for auth, discovery, orders, owner, admin, AI
│   └── locationService.ts          # Browser geolocation & city resolution helper
├── components/
│   ├── HeaderBar.tsx               # Role-aware navbar, city selector, theme toggle, profile/sign-out menu
│   ├── AuthModal.tsx               # Landing hero + Sign In / Register + subtle demo role switcher
│   ├── WhyRestaurantHubView.tsx    # Value proposition & commission-free marketplace breakdown
│   ├── HeroSection.tsx             # Customer search hero
│   ├── RankedRestaurantRow.tsx     # 1-per-row restaurant listing (rank/bid hidden from customers)
│   ├── RestaurantCard.tsx          # Compact restaurant card for grids
│   ├── RestaurantDetailView.tsx    # Restaurant menu, reviews, offers, and AI menu highlights
│   ├── MenuCard.tsx & ItemModal.tsx# Dish cards, portions, add-ons, and cart customization
│   ├── LiveOrderBanner.tsx         # Real-time active order tracker banner
│   ├── OrdersView.tsx & OrderStatusStepper.tsx # Order history and step-by-step kitchen progress
│   ├── LiveBiddingShowcase.tsx     # Restaurant Owner live leaderboard & dynamic bidding console
│   ├── OwnerDashboardView.tsx      # Restaurant Owner analytics, menu CRUD, AI menu draft, and orders
│   ├── AdminView.tsx               # Platform admin moderation, campaign rules, and audit logs
│   ├── ChatInterface.tsx           # Bottom-right AI concierge (chat + fullscreen WebAudio PCM voice)
│   └── SmartImage.tsx              # Resilient image loader with fallback handling
├── server/
│   ├── api.ts                      # Express API router & RBAC-enforced endpoints
│   ├── auth.ts                     # scrypt password hashing, session tokens, role & ownership guards
│   ├── bidding.ts                  # Dynamic scaling bid step calculation (cents to dollars, +5%)
│   ├── db.ts                       # Node native SQLite (node:sqlite) schema & WAL setup
│   ├── neonDb.ts                   # Optional Neon PostgreSQL pool & hybrid health/sync helper
│   ├── seed.ts                     # Idempotent initial seed data for demo/testing
│   └── ai.ts                       # Gemini AI discovery, menu draft extraction, and owner co-pilot
└── scripts/
    ├── run-verify.mjs              # Spawns server and runs end-to-end verification
    └── verify-workflows.ts         # Automated E2E tests (auth, RBAC, scaling bids, orders, AI)
```

---

## Key Features

### 1. Role-Based Access & Isolation
- **Unauthenticated Landing (`AuthModal.tsx`)**: Production Sign In / Create Account / Register Restaurant page with an intro hero and `"See more"` link to the **Why Us** page. Demo role exploration (`Customer` / `Restaurant`) is tucked under `"Just exploring? Try a demo role"`. AI features remain hidden until signed in.
- **Customer Role**:
  - Dedicated search bar, **Top Restaurants** list (1 per row), **Top Rated** navbar view (`sortBy=rating`), **Trending Food**, **Nearest Restaurants**, **Favourites**, and **My Orders**.
  - Customers never see bidding controls, bid dollar amounts, or paid rank numbers.
  - Authenticated bottom-right AI concierge (`ChatInterface.tsx`) supporting text chat and live fullscreen voice ordering.
- **Restaurant Owner Role**:
  - **Bidding & Rank** (`LiveBiddingShowcase.tsx`) and **Owner Dashboard** (`OwnerDashboardView.tsx`) for managing menus (including AI Voice/Text Menu Architect), live kitchen order statuses, and featured placement bids.
  - Non-relevant customer sections (such as trending food) are hidden from restaurant owners.
- **Admin Role**:
  - Marketplace moderation, campaign rule configuration, user/restaurant governance, and audit logs (`AdminView.tsx`).

### 2. Dynamic Scaling Bidding Engine (`server/bidding.ts`)
- Paid featured placement is strictly restricted to `restaurant_owner` and `admin` roles on both the UI and backend (`/api/bidding/public-bid`, `/api/owner/restaurants/:id/bids`).
- **Gradual Scaling Increments**: Opening bids can start in cents (`$0.10` default floor, `$0.01` minimum step) and scale dynamically (`+5%` of the current leading bid, rounded up to the nearest cent) instead of a fixed jump.
- Bids are executed inside atomic SQLite `BEGIN IMMEDIATE` transactions with outbid notifications and ledger records.
- Organic ratings remain strictly independent on the dedicated **Top Rated** page.

### 3. Persistence Layer (`server/db.ts` & `server/neonDb.ts`)
- **Primary Local Store**: Uses Node.js built-in `node:sqlite` (`DatabaseSync`) with WAL mode and foreign-key constraints (`data/restaurant_hub.db`).
- **Neon PostgreSQL Support**: `server/neonDb.ts` connects via `DATABASE_URL` when configured, exposing health status while preserving deterministic local state.

---

## Setup & Running Locally

### Prerequisites
- **Node.js**: `v22.5.0+` (required for native `node:sqlite`)

### Environment Variables (`AI Receptionist/.env.local`)
```env
GEMINI_API_KEY=your_gemini_api_key_here
# Optional Neon PostgreSQL connection string:
# DATABASE_URL=postgresql://...
```

### Install & Run
```bash
cd "AI Receptionist"
npm install
npm run dev
```

### Verification & Build
```bash
cd "AI Receptionist"
npm run typecheck   # TypeScript strict check (tsc --noEmit)
npm run test        # End-to-end workflow verification (scripts/run-verify.mjs)
npm run build       # Production Vite bundle
```

### Demo Accounts (Password: `Password123!`)
| Role | Email | Notes |
|---|---|---|
| **Customer** | `customer@restauranthub.com` | Browse, order, and use the AI voice/text concierge |
| **Restaurant Owner** | `owner@abdulahadkitchen.com` | Manage *Abdul Ahad's Kitchen*, menu, orders, and bids |
| **Restaurant Owner** | `owner@zaffran.com` | Manage *Zaffran Royal* & *Forno Napoli* |
| **Administrator** | `admin@restauranthub.com` | Platform governance & campaign rules |

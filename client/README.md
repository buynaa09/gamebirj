# ASCEND — Gaming Account Marketplace

A React + TypeScript conversion of the ASCEND gaming marketplace UI, built with Vite and CSS Modules.

## Getting Started

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` — Start the dev server
- `npm run build` — Type-check and build for production
- `npm run lint` — Run ESLint
- `npm run preview` — Preview the production build

## Project Structure

```
src/
├── App.tsx                    # Root component with routing
├── App.module.css             # Shared button styles
├── index.css                  # Theme tokens (CSS variables) + global resets
├── main.tsx                   # Entry point
│
├── types/
│   └── index.ts               # Listing, GameFilter, Theme types
│
├── data/
│   ├── listings.ts            # Mock listing data
│   └── games.ts               # Pill + sidebar game filter data
│
├── context/
│   ├── ThemeContext.tsx         # Theme context definition + useTheme hook
│   └── ThemeProvider.tsx        # Theme provider with localStorage persistence
│
├── components/
│   ├── icons/
│   │   └── Icons.tsx           # All SVG icon components
│   │
│   ├── layout/
│   │   ├── TopBar.tsx          # Sticky top nav + mobile menu
│   │   ├── TopBar.module.css
│   │   ├── BottomNav.tsx       # Mobile bottom nav (visible < 900px)
│   │   └── ChatBubble.tsx      # Floating chat CTA
│   │
│   ├── home/
│   │   ├── Hero.tsx            # Hero section with CTAs
│   │   ├── Hero.module.css
│   │   ├── TradeDemoCard.tsx   # Escrow demo card
│   │   ├── TradeDemoCard.module.css
│   │   ├── InfoStrip.tsx       # "How it works" strip
│   │   └── InfoStrip.module.css
│   │
│   ├── marketplace/
│   │   ├── MarketplaceHeader.tsx   # Breadcrumbs + title
│   │   ├── MarketplaceHeader.module.css
│   │   ├── FiltersSidebar.tsx      # Desktop sidebar filters
│   │   ├── FiltersSidebar.module.css
│   │   ├── SearchBar.tsx           # Search input + mobile filter btn
│   │   ├── SearchBar.module.css
│   │   ├── GamePillFilter.tsx      # Horizontal game pill filters
│   │   ├── GamePillFilter.module.css
│   │   ├── SortSelect.tsx          # Results count + sort dropdown
│   │   ├── SortSelect.module.css
│   │   ├── ListingGrid.tsx         # Card grid
│   │   ├── ListingGrid.module.css
│   │   ├── ListingCard.tsx         # Individual listing card
│   │   └── ListingCard.module.css
│
└── pages/
    ├── HomePage.tsx            # Home route (/)
    ├── MarketplacePage.tsx     # Marketplace route (/marketplace)
    └── MarketplacePage.module.css
```

## Key Design Decisions

- **CSS Modules** for component-scoped styles, preserving the original CSS variables as a shared theme layer in `index.css`.
- **React Router** replaces the original JS `goTo()` page switching with proper URL-based routing.
- **Theme** stored in `localStorage` with `prefers-color-scheme` fallback on first load, managed via React Context.
- **Listing filtering** is client-side: game pill filter + search input filter the typed listings array via `useState`/`useMemo`.
- **All original breakpoints, animations, and responsive behavior** are preserved identically (mobile bottom nav < 900px, sidebar filters ≥ 960px, grid columns at 640px/1180px).

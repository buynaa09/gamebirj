# Repository: GameBirj

Gaming account marketplace — two-package repo: Django backend + React/Vite client.

## Structure

```
backend/    Django 6.0 (Python 3.14), cookiecutter-django scaffold, Docker-based
client/     React 19 + TypeScript + Vite, CSS Modules, Tailwind v4
```

No monorepo tooling — `client/` and `backend/` are independent, no shared workspace root package.json.

## Client (`client/`)

```bash
cd client && npm install
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run lint         # ESLint (flat config)
```

**Stack:** React 19, React Router, CSS Modules (not Tailwind for component styles — Tailwind is installed but unused). Theme tokens live in `src/index.css` as CSS variables (`--bg`, `--red`, `--border`, etc.).

**Key conventions:**
- CSS Modules for scoped styles; shared button classes (`.btn`, `.btn-primary`, `.btn-outline`) are global in `index.css`.
- Theme toggle uses `data-theme` attribute on `<html>`, persisted to localStorage, with `prefers-color-scheme` fallback.
- All SVG icons extracted to `src/components/icons/Icons.tsx`.
- Responsive breakpoints: 560px, 640px, 900px, 960px, 980px, 1180px — match original HTML pixel-for-pixel.
- Bottom nav hidden at ≥900px via CSS media query (not inline styles — CSS Modules required for media queries).
- NavLink active state must use `styles.active` from CSS Module, not plain string `'active'`.

## Backend (`backend/`)

Cookiecutter Django scaffold. Docker Compose for local dev.

```bash
cd backend
uv run python manage.py createsuperuser   # create admin
uv run pytest                              # run tests
uv run mypy backend                        # type checks
```

Or via Docker (uses `just`):
```bash
just build    # docker compose build
just up       # docker compose up -d
just manage <cmd>   # run manage.py in container
just pytest   # run tests in container
```

**Stack:** Django 6.0, Python 3.14, PostgreSQL, Redis, django-ninja (API), django-allauth, gunicorn + uvicorn.

**Settings:** `config/settings/{base,local,production,test}.py`. Env files in `.envs/.local/`.

**Linting:** ruff (linter + formatter), djlint (templates), pre-commit hooks configured. Migrations excluded from ruff.

**Testing:** pytest with `--reuse-db`, `--import-mode=importlib`. Settings module: `config.settings.test`.

## Gotchas

- `client/` uses `verbatimModuleSyntax` in tsconfig — imports must use `import type` for type-only imports.
- Backend requires Python 3.14 exactly (`requires-python = "==3.14.*"`).
- ESLint in client is strict: no `any`, no unused vars, `react-hooks/set-state-in-effect` and `react-hooks/refs` rules enforced.
- Theme/class name mismatches: always use CSS Module references (e.g., `styles.on`, `styles.active`) — plain strings won't match hashed class names.

# BrickHunter

Lego set price search and comparison agent. Searches eBay, BrickLink, LEGO.com, and BrickEconomy to find the best deals on Lego sets.

## Tech stack

- **Runtime**: Node.js (pure JS, ESM modules)
- **Framework**: Express 5
- **Database**: PostgreSQL (via `pg`)
- **Logging**: pino
- **Deployment target**: AWS + Cloudflare

## Project structure

```
src/
  index.js              — entry point, starts Express server
  config.js             — env-based configuration
  db/
    index.js            — pg pool
    migrate.js          — migration runner
    migrations/         — numbered .sql files
    queries/            — per-table query modules (sets, listings, searches)
  sources/
    index.js            — searchAll() aggregator
    ebay.js             — eBay Browse API
    bricklink.js        — BrickLink API (OAuth 1.0a)
    lego.js             — LEGO.com scraper
    brickeconomy.js     — BrickEconomy scraper
  agent/
    index.js            — hunt() orchestrator
    llm.js              — provider-agnostic LLM client (anthropic/openai)
  api/
    index.js            — Express app setup
    routes/
      search.js         — POST /api/search, GET /api/search/history
      sets.js           — GET /api/sets/:setNumber, GET /api/sets/:setNumber/listings
  utils/
    logger.js           — pino logger
```

## Commands

- `npm run dev` — start dev server with watch mode
- `npm start` — start production server
- `npm run migrate` — run database migrations

## API endpoints

- `GET /health` — health check
- `POST /api/search` — search for a set: `{ query, condition?, sources? }`
- `GET /api/search/history` — recent searches
- `GET /api/sets/:setNumber` — get a stored set
- `GET /api/sets/:setNumber/listings` — get listings for a set

## Environment

Copy `.env.example` to `.env` and fill in credentials. The LLM layer is optional — the search works without it but won't resolve natural-language queries or generate summaries.

## Future

- Amex ACE Developer Kit integration for agentic payment
- Scheduled price monitoring and alerts
- Frontend UI

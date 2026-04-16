# BrickHunter

A Lego set price search and comparison agent. BrickHunter searches across eBay, BrickLink, LEGO.com, and BrickEconomy to find the best deals on any Lego set. It can be used as a REST API, or plugged directly into Claude (or any MCP-compatible AI) as an MCP server.

The long-term goal is to connect to the [American Express ACE Developer Kit](https://developer.americanexpress.com/products/nextgen-agentic-payments/overview) so an AI agent can find **and purchase** the best deal on a user's behalf using tokenized Amex credentials.

## How it works

1. You give it a set number (`75192`) or a natural-language query (`"UCS Millennium Falcon"`)
2. If the query is text, an optional LLM resolves it to a set number
3. It searches all four price sources concurrently
4. Results are sorted by total cost (price + shipping) and stored in PostgreSQL
5. Set metadata is enriched from the Rebrickable catalogue (name, theme, year, piece count, image)
6. An optional LLM summary highlights the best deal

## Prerequisites

- **Node.js** >= 20
- **PostgreSQL** (any recent version)

## Quick start

```bash
# Clone and install
git clone https://github.com/vdmholding/brickhunter.git
cd brickhunter
npm install

# Configure
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL

# Create tables
npm run migrate

# (Optional) Seed the Lego set catalogue from Rebrickable
npm run seed

# Start the API server
npm run dev
```

## Configuration

All configuration is via environment variables (`.env` file). Copy `.env.example` to get started.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | API server port (default: 3000) |
| `REBRICKABLE_API_KEY` | No | Enables catalogue seeding and on-demand set enrichment. Free at [rebrickable.com/api](https://rebrickable.com/api/) |
| `EBAY_APP_ID`, `EBAY_CERT_ID`, `EBAY_DEV_ID` | No | Enables eBay price search. Register at [developer.ebay.com](https://developer.ebay.com/) |
| `BRICKLINK_CONSUMER_KEY`, `BRICKLINK_CONSUMER_SECRET`, `BRICKLINK_TOKEN`, `BRICKLINK_TOKEN_SECRET` | No | Enables BrickLink price guide lookups. Register at [bricklink.com/v3/api.page](https://www.bricklink.com/v3/api.page) |
| `LLM_PROVIDER` | No | `anthropic` or `openai` — enables natural-language query resolution and deal summaries |
| `LLM_API_KEY` | No | API key for the chosen LLM provider |
| `LLM_MODEL` | No | Model override (defaults to `claude-sonnet-4-20250514` or `gpt-4o`) |

Each source is optional. BrickHunter searches whichever sources have credentials configured and skips the rest. LEGO.com and BrickEconomy work without API keys (they use Puppeteer to scrape rendered product pages).

## Seeding the catalogue

The catalogue can be bulk-loaded from Rebrickable's database of 20,000+ Lego sets:

```bash
# All sets
npm run seed

# Just 2024 sets
npm run seed -- --year 2024

# Just Star Wars (theme ID 158)
npm run seed -- --theme 158

# Year range
npm run seed -- --min-year 2020 --max-year 2025
```

Sets are also enriched on-demand: when you search for a set not in the database, BrickHunter pulls its metadata from Rebrickable automatically.

## REST API

Start the server with `npm run dev` (watch mode) or `npm start` (production).

### Search for a set

```bash
curl -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "75192", "condition": "new"}'
```

Request body:

| Field | Type | Description |
|-------|------|-------------|
| `query` | string (required) | Set number or natural-language description |
| `condition` | `"new"` or `"used"` | Filter by condition |
| `sources` | string[] | Limit to specific sources, e.g. `["ebay", "bricklink"]` |

Response includes the set metadata, all listings sorted by price, the best deal, and an LLM-generated summary (if configured).

### Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/search/history` | Recent searches |
| `GET` | `/api/sets?q=millennium+falcon` | Search sets by name (falls back to Rebrickable) |
| `GET` | `/api/sets/:setNumber` | Get a set from the catalogue |
| `GET` | `/api/sets/:setNumber/listings` | Get stored listings for a set |

### Price monitors

Set up a watch on a set and get alerted when the price drops below your target:

```bash
# Create a monitor
curl -X POST http://localhost:3000/api/monitors \
  -H 'Content-Type: application/json' \
  -d '{"setNumber": "75192", "targetPrice": 500, "condition": "new"}'

# List monitors
curl http://localhost:3000/api/monitors

# Manually trigger a check
curl -X POST http://localhost:3000/api/monitors/1/check

# View recent alerts
curl http://localhost:3000/api/monitors/alerts/recent

# Deactivate a monitor
curl -X DELETE http://localhost:3000/api/monitors/1
```

The monitor scheduler runs automatically when the server starts, checking all active monitors every 30 minutes.

## MCP server

BrickHunter also runs as an [MCP](https://modelcontextprotocol.io/) server, so any compatible AI (Claude, etc.) can use it as a tool.

### Tools

| Tool | Description |
|------|-------------|
| `hunt` | Search all sources for a set by number or name. Returns listings, best deal, and summary. |
| `get_set` | Look up a set in the local catalogue |
| `search_sets` | Search the catalogue by name |
| `get_listings` | Get stored price listings from previous searches |
| `compare_prices` | Live per-source price comparison — best price from each source side by side |
| `search_history` | View recent search log |

### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "brickhunter": {
      "command": "node",
      "args": ["src/mcp.js"],
      "cwd": "/absolute/path/to/brickhunter",
      "env": {
        "DATABASE_URL": "postgres://user:password@localhost:5432/brickhunter"
      }
    }
  }
}
```

### Claude Code

Add to your project or global settings:

```json
{
  "mcpServers": {
    "brickhunter": {
      "command": "node",
      "args": ["src/mcp.js"],
      "cwd": "/absolute/path/to/brickhunter"
    }
  }
}
```

## Data model

```
sets 1──────* listings
```

**sets** — Lego set catalogue (set number, name, theme, year, piece count, retail price, image).
Populated via Rebrickable seed or on-demand enrichment.

**listings** — Price listings from all sources (source, condition, price, currency, shipping, seller, URL, timestamp). A new row is created each time a listing is found, building a price history over time.

**searches** — Log of every search query with the resolved set number, result count, best price, and best source.

**monitors** — Price watch list. Each monitor tracks a set number, target price, and optional condition/source filters. The scheduler checks all active monitors periodically.

**alerts** — Triggered when a monitor's target price is met. Stores the price, source, and listing URL.

## Price sources

| Source | Method | Auth required | Notes |
|--------|--------|---------------|-------|
| eBay | Browse API | Yes (OAuth2 client credentials) | Real-time auction and Buy It Now listings |
| BrickLink | REST API | Yes (OAuth 1.0a) | Price guide data from the largest Lego marketplace |
| LEGO.com | Puppeteer scrape | No | Official retail price and availability |
| BrickEconomy | Puppeteer scrape | No | Market value tracking, new and used prices |
| Rebrickable | REST API | Yes (API key) | Catalogue only — set metadata, not prices |

## Project structure

```
src/
  index.js              Entry point — Express server
  mcp.js                Entry point — MCP server (stdio)
  config.js             Environment-based configuration

  agent/
    index.js            hunt() orchestrator
    llm.js              Provider-agnostic LLM client (Anthropic / OpenAI)
    monitor.js          Price monitor scheduler and checker

  sources/
    index.js            searchAll() — concurrent multi-source aggregator
    ebay.js             eBay Browse API
    bricklink.js        BrickLink API (OAuth 1.0a)
    lego.js             LEGO.com scraper
    brickeconomy.js     BrickEconomy scraper
    rebrickable.js      Rebrickable catalogue API

  db/
    index.js            PostgreSQL connection pool
    migrate.js          Migration runner
    seed.js             Catalogue seeder (Rebrickable)
    migrations/         Numbered SQL migration files
    queries/            Per-table query modules

  api/
    index.js            Express app setup
    routes/
      search.js         Search endpoints
      sets.js           Set and listing endpoints
      monitors.js       Monitor and alert endpoints

  utils/
    logger.js           pino logger (writes to stderr)
    browser.js          Shared Puppeteer instance for scrapers

test/                   Unit tests (Node.js test runner)
```

## Deployment

Designed for **AWS** with **Cloudflare** in front. The Express API is a standard Node.js HTTP server — deploy behind an ALB, on ECS, Lambda, or EC2. PostgreSQL on RDS.

## Testing

```bash
npm test
```

Uses Node.js built-in test runner. Tests cover database queries (sets, listings, monitors), the API layer, and source aggregation logic. Requires a running PostgreSQL instance with the `DATABASE_URL` configured.

## Roadmap

- **Amex ACE integration** — use the American Express Agentic Commerce Experiences Developer Kit to let the agent purchase sets on behalf of users with tokenized Amex credentials and purchase protection
- **Alert delivery** — email, webhook, or push notification when a price target is hit
- **Frontend UI** — browse, search, and track sets visually

## License

MIT

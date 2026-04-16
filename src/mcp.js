import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { hunt } from './agent/index.js';
import { searchAll } from './sources/index.js';
import * as setsDb from './db/queries/sets.js';
import * as listingsDb from './db/queries/listings.js';
import * as searchesDb from './db/queries/searches.js';
import logger from './utils/logger.js';

const server = new McpServer({
  name: 'brickhunter',
  version: '0.1.0',
});

// --- Tools ---

server.registerTool(
  'hunt',
  {
    description:
      'Search for a Lego set across eBay, BrickLink, LEGO.com, and BrickEconomy. ' +
      'Accepts a set number (e.g. "75192") or a natural-language description (e.g. "UCS Millennium Falcon"). ' +
      'Returns price listings sorted by total cost, the best deal, and an optional AI summary.',
    inputSchema: {
      query: z.string().describe('Lego set number or name to search for'),
      condition: z
        .enum(['new', 'used'])
        .optional()
        .describe('Filter by condition'),
      sources: z
        .array(z.enum(['ebay', 'bricklink', 'lego', 'brickeconomy']))
        .optional()
        .describe('Limit search to specific sources'),
    },
  },
  async ({ query, condition, sources }) => {
    const result = await hunt(query, { condition, only: sources });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              set: result.set,
              bestDeal: result.bestDeal,
              totalListings: result.listings.length,
              listings: result.listings.slice(0, 20),
              summary: result.summary,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  'get_set',
  {
    description:
      'Look up a Lego set by its set number from the local catalogue. ' +
      'Returns set metadata (name, theme, year, piece count, image).',
    inputSchema: {
      set_number: z.string().describe('Lego set number, e.g. "75192"'),
    },
  },
  async ({ set_number }) => {
    const set = await setsDb.findBySetNumber(set_number);

    if (!set) {
      return {
        content: [{ type: 'text', text: `Set ${set_number} not found in catalogue.` }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(set, null, 2) }],
    };
  }
);

server.registerTool(
  'search_sets',
  {
    description:
      'Search for Lego sets by name. ' +
      'Searches the local catalogue first, then falls back to Rebrickable if no local matches.',
    inputSchema: {
      name: z.string().describe('Search term to match against set names'),
    },
  },
  async ({ name }) => {
    const sets = await setsDb.searchByNameWithFallback(name);

    return {
      content: [
        {
          type: 'text',
          text: sets.length
            ? JSON.stringify(sets, null, 2)
            : `No sets found matching "${name}".`,
        },
      ],
    };
  }
);

server.registerTool(
  'get_listings',
  {
    description:
      'Get stored price listings for a Lego set from previous searches. ' +
      'Optionally filter by source. Returns listings sorted by price ascending.',
    inputSchema: {
      set_number: z.string().describe('Lego set number, e.g. "75192"'),
      source: z
        .enum(['ebay', 'bricklink', 'lego', 'brickeconomy'])
        .optional()
        .describe('Filter listings to a single source'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max listings to return (default 50)'),
    },
  },
  async ({ set_number, source, limit }) => {
    const set = await setsDb.findBySetNumber(set_number);
    if (!set) {
      return {
        content: [{ type: 'text', text: `Set ${set_number} not found in catalogue.` }],
      };
    }

    const listings = await listingsDb.findBySetId(set.id, { source, limit });
    const best = await listingsDb.bestPrice(set.id);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ set, bestDeal: best, listings }, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  'search_history',
  {
    description: 'Get recent search history showing what sets have been searched for and the best prices found.',
    inputSchema: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max entries to return (default 20)'),
    },
  },
  async ({ limit }) => {
    const searches = await searchesDb.recentSearches(limit || 20);

    return {
      content: [{ type: 'text', text: JSON.stringify(searches, null, 2) }],
    };
  }
);

server.registerTool(
  'compare_prices',
  {
    description:
      'Search for a Lego set across all sources and return a per-source price comparison. ' +
      'Useful for quickly seeing which source has the best deal.',
    inputSchema: {
      set_number: z.string().describe('Lego set number, e.g. "75192"'),
      condition: z
        .enum(['new', 'used'])
        .optional()
        .describe('Filter by condition'),
    },
  },
  async ({ set_number, condition }) => {
    const listings = await searchAll(set_number, { condition });

    // Group by source, pick best from each
    const bySource = {};
    for (const l of listings) {
      const total = l.price + (l.shipping || 0);
      if (!bySource[l.source] || total < bySource[l.source].total) {
        bySource[l.source] = { ...l, total };
      }
    }

    const comparison = Object.values(bySource).sort((a, b) => a.total - b.total);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              set_number,
              condition: condition || 'any',
              sources_checked: ['ebay', 'bricklink', 'lego', 'brickeconomy'],
              best_per_source: comparison,
              overall_best: comparison[0] || null,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('BrickHunter MCP server running on stdio');
}

main().catch((err) => {
  logger.error({ err }, 'MCP server failed to start');
  process.exit(1);
});

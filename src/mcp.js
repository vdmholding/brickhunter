import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { hunt } from './agent/index.js';
import { searchAll } from './sources/index.js';
import { checkMonitor } from './agent/monitor.js';
import * as setsDb from './db/queries/sets.js';
import * as listingsDb from './db/queries/listings.js';
import * as searchesDb from './db/queries/searches.js';
import * as monitorsDb from './db/queries/monitors.js';
import logger from './utils/logger.js';

// --- Version info ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: join(__dirname, '..'), encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const VERSION = pkg.version;
const COMMIT = getGitCommit();

const server = new McpServer({
  name: 'brickhunter',
  version: VERSION,
});

// --- Tools ---

server.registerTool(
  'version',
  {
    description: 'Show BrickHunter server version and git commit.',
    inputSchema: {},
  },
  async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({ name: 'brickhunter', version: VERSION, commit: COMMIT }, null, 2),
    }],
  })
);

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

// --- Monitor tools ---

server.registerTool(
  'create_monitor',
  {
    description:
      'Create a price monitor to watch a Lego set. ' +
      'When the price drops below the target, an alert is recorded. ' +
      'Monitors are checked automatically every 30 minutes when the server runs.',
    inputSchema: {
      set_number: z.string().describe('Lego set number to monitor, e.g. "75192"'),
      target_price: z.number().positive().describe('Alert when total price (price + shipping) drops below this'),
      condition: z
        .enum(['new', 'used'])
        .optional()
        .describe('Only monitor listings in this condition'),
      sources: z
        .array(z.enum(['ebay', 'bricklink', 'lego', 'brickeconomy']))
        .optional()
        .describe('Limit monitoring to specific sources'),
    },
  },
  async ({ set_number, target_price, condition, sources }) => {
    const monitor = await monitorsDb.create({
      setNumber: set_number,
      targetPrice: target_price,
      condition,
      sources,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(monitor, null, 2) }],
    };
  }
);

server.registerTool(
  'list_monitors',
  {
    description: 'List all price monitors. Shows active and inactive monitors with their last check results.',
    inputSchema: {
      active_only: z.boolean().optional().describe('Only show active monitors (default: false)'),
    },
  },
  async ({ active_only }) => {
    const monitors = active_only ? await monitorsDb.listActive() : await monitorsDb.listAll();

    return {
      content: [{
        type: 'text',
        text: monitors.length
          ? JSON.stringify(monitors, null, 2)
          : 'No monitors configured.',
      }],
    };
  }
);

server.registerTool(
  'check_monitor',
  {
    description: 'Manually trigger a price check for a specific monitor. Returns the current best price and whether an alert was triggered.',
    inputSchema: {
      monitor_id: z.number().int().positive().describe('ID of the monitor to check'),
    },
  },
  async ({ monitor_id }) => {
    const monitor = await monitorsDb.findById(monitor_id);
    if (!monitor) {
      return {
        content: [{ type: 'text', text: `Monitor ${monitor_id} not found.` }],
      };
    }

    const result = await checkMonitor(monitor);
    const updated = await monitorsDb.findById(monitor_id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          monitor: updated,
          alert: result.alert,
          bestListing: result.bestListing,
        }, null, 2),
      }],
    };
  }
);

server.registerTool(
  'delete_monitor',
  {
    description: 'Deactivate a price monitor. It will no longer be checked on the schedule.',
    inputSchema: {
      monitor_id: z.number().int().positive().describe('ID of the monitor to deactivate'),
    },
  },
  async ({ monitor_id }) => {
    const monitor = await monitorsDb.deactivate(monitor_id);
    if (!monitor) {
      return {
        content: [{ type: 'text', text: `Monitor ${monitor_id} not found.` }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(monitor, null, 2) }],
    };
  }
);

server.registerTool(
  'get_alerts',
  {
    description: 'Get recent price alerts across all monitors, or for a specific monitor.',
    inputSchema: {
      monitor_id: z.number().int().positive().optional().describe('Filter alerts to a specific monitor'),
      limit: z.number().int().min(1).max(200).optional().describe('Max alerts to return (default 50)'),
    },
  },
  async ({ monitor_id, limit }) => {
    const alerts = monitor_id
      ? await monitorsDb.getAlerts(monitor_id, limit || 20)
      : await monitorsDb.recentAlerts(limit || 50);

    return {
      content: [{
        type: 'text',
        text: alerts.length
          ? JSON.stringify(alerts, null, 2)
          : 'No alerts.',
      }],
    };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info({ version: VERSION, commit: COMMIT }, 'BrickHunter MCP server running on stdio');
}

main().catch((err) => {
  logger.error({ err }, 'MCP server failed to start');
  process.exit(1);
});

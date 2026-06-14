# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/

  # Agent Directives for usdt-news-bot

## Core Architecture
- **Environment:** Cloudflare Workers (Serverless/Edge).
- **Database:** Cloudflare D1 with Drizzle ORM.
- **Goal:** Run scheduled tasks (crons) to fetch, process, and post Web3/USDT news to Telegram.

## Rules for AI Agents
1. **No DevOps:** Do not suggest Docker, VPS, or traditional servers. Stick to Cloudflare ecosystem.
2. **Minimalism:** Follow the 80/20 rule. Write functional, boilerplate-ready code. Prevent feature creep.
3. **Database Changes:** Always use Drizzle ORM for any modifications to the SQLite schema. Do not write raw SQL queries for standard CRUD operations.
4. **Error Handling:** Fail silently where necessary during chron jobs to prevent crashing the entire execution pipeline, but log critical errors.

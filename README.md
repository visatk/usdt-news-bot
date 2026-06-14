# USDT News Bot

A high-performance, serverless Web3/USDT news aggregator and Telegram broadcast bot. Engineered exclusively for the Cloudflare Edge ecosystem to ensure zero-maintenance scalability, robust security, and seamless deployment.

## Architecture Overview

- **Compute:** Cloudflare Workers (Serverless Edge Execution). Handles both API webhooks and scheduled cron triggers.
- **Database:** Cloudflare D1 (Serverless SQLite) interfaced via Drizzle ORM for type-safe schema management.
- **Data Ingestion:** Cloudflare Browser Rendering API. Executes parallelized headless browser sessions with integrated AI extraction (JSON schema enforcement) to reliably scrape dynamic crypto news sources.
- **Delivery:** grammY framework for Telegram API interactions.

## Security & Reliability (AppSec Highlights)

- **Webhook Authentication:** Enforces strict validation of incoming Telegram requests using the `X-Telegram-Bot-Api-Secret-Token` header to prevent unauthorized API execution.
- **Markup Sanitization:** Implements comprehensive HTML entity escaping prior to Telegram dispatch to neutralize markup injection vulnerabilities.
- **Idempotency & Deduplication:** Tracks successfully broadcasted article URLs within the D1 database to prevent duplicate notifications.
- **Fault Tolerance:** Cron executions utilize parallel fetching and localized try-catch blocks. Individual node failures (e.g., a single site scraping timeout or broadcast error) fail silently, preserving the execution pipeline of the broader scheduled task.

## Prerequisites

- Node.js (v20+)
- Cloudflare Account (with Workers, D1, and Browser Rendering enabled)
- Telegram Bot Token (via BotFather) & Target Channel ID

## Environment Variables & Secrets

Configure the following secrets via `wrangler secret put <KEY>` for production, or place them in a `.dev.vars` file for local development:

```env
CF_ACCOUNT_ID="your_cloudflare_account_id"
CF_API_TOKEN="your_cloudflare_api_token_with_browser_rendering_access"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHANNEL_ID="@your_channel_id_or_numeric_id"
TELEGRAM_WEBHOOK_SECRET="secure_random_string_for_webhook_validation"
```

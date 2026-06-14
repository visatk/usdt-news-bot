import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Bot, webhookCallback } from 'grammy';
import { Env } from './types';
import { postedLeads } from './db/schema';
import { fetchCryptoNews } from './services/crawler';
import { broadcastNews } from './services/telegram';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		// AppSec: Prevent unauthorized executions by verifying the secret token
		const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
		if (secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
			return new Response("Unauthorized Webhook Request", { status: 401 });
		}

		try {
			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			
			bot.command("start", (ctx) => ctx.reply("🚀 USDT News Bot is securely active! Real-time Web3 updates will be posted."));
			
			const cb = webhookCallback(bot, 'cloudflare-mod');
			return await cb(request);
		} catch (error) {
			console.error("Webhook Error:", error);
			return new Response("Webhook execution failed", { status: 500 });
		}
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		const db = drizzle(env.DB);

		try {
			const articles = await fetchCryptoNews(env);

			for (const article of articles) {
				// Validate schema structure to prevent DB crashes
				if (!article.url || !article.title) continue;

				const existing = await db.select().from(postedLeads).where(eq(postedLeads.url, article.url)).get();

				if (!existing) {
					try {
						await broadcastNews(env, article);
						await db.insert(postedLeads).values({ url: article.url, title: article.title }).run();
					} catch (broadcastErr) {
						// Fail silently for individual nodes to prevent halting the entire cron sequence
						console.error(`Failed to broadcast article ${article.url}:`, broadcastErr);
					}
				}
			}
		} catch (error) {
			console.error('Scheduled task (Cron) failed:', error);
		}
	},
};

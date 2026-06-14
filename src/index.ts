import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Bot, webhookCallback } from 'grammy';
import { Env } from './types';
import { postedLeads } from './db/schema';
import { fetchCryptoNews } from './services/crawler';
import { broadcastNews } from './services/telegram';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		try {
			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			
			bot.command("start", (ctx) => ctx.reply("🚀 USDT News Bot is active! Real-time Web3 updates will be posted to the channel automatically."));
			
			// Using 'cloudflare-mod' for module-based workers
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
				const existing = await db.select().from(postedLeads).where(eq(postedLeads.url, article.url)).get();

				if (!existing) {
					try {
						await broadcastNews(env, article);
						await db.insert(postedLeads).values({ url: article.url, title: article.title }).run();
					} catch (broadcastErr) {
						console.error(`Failed to broadcast article ${article.url}:`, broadcastErr);
					}
				}
			}
		} catch (error) {
			console.error('Scheduled task (Cron) failed:', error);
		}
	},
};

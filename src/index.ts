import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Bot, webhookCallback } from 'grammy';
import { Env } from './types';
import { postedLeads } from './db/schema';
import { fetchCryptoNews } from './services/crawler';
import { broadcastNews } from './services/telegram';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
		
		bot.command("start", (ctx) => ctx.reply("USDT News Bot is running! Data is posted to the channel automatically."));
		
		const cb = webhookCallback(bot, 'cloudflare-mod');
		return cb(request);
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		const db = drizzle(env.DB);

		try {
			const articles = await fetchCryptoNews(env);

			for (const article of articles) {
				const articleUrl = article.url.startsWith('http') ? article.url : `https://cryptonews.com${article.url}`;
				
				const existing = await db.select().from(postedLeads).where(eq(postedLeads.url, articleUrl)).get();

				if (!existing) {
					await broadcastNews(env, { ...article, url: articleUrl });
					await db.insert(postedLeads).values({ url: articleUrl, title: article.title }).run();
				}
			}
		} catch (error) {
			console.error('Scheduled task failed:', error);
		}
	},
};

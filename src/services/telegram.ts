import { Bot } from 'grammy';
import { Env } from '../types';

export const broadcastNews = async (env: Env, article: { title: string; summary: string; url: string }) => {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
	
	// AppSec: Sanitize potentially harmful AI-generated or scraped outputs to prevent markup injection
	const safeTitle = article.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const safeSummary = article.summary.replace(/</g, "&lt;").replace(/>/g, "&gt;");
	
	// Use HTML parse mode instead of Markdown to strictly control rendering limits
	const message = `🟢 <b>${safeTitle}</b>\n\n💡 <i>${safeSummary}</i>\n\n🔗 <a href="${article.url}">Read Full News</a>`;
	
	await bot.api.sendMessage(env.TELEGRAM_CHANNEL_ID, message, {
		parse_mode: 'HTML',
		disable_web_page_preview: false,
	});
};

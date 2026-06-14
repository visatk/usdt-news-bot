import { Bot } from 'grammy';
import { Env } from '../types';

// AppSec: Complete HTML entity escaping function to prevent markup injection
const escapeHTML = (text: string) => {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
};

export const broadcastNews = async (env: Env, article: { title: string; summary: string; url: string }) => {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
	
	// Apply robust escaping to prevent Telegram API parsing crashes (Denial of Service)
	const safeTitle = escapeHTML(article.title);
	const safeSummary = escapeHTML(article.summary);
	const safeUrl = escapeHTML(article.url); // Sanitize URL block
	
	const message = `🟢 <b>${safeTitle}</b>\n\n💡 <i>${safeSummary}</i>\n\n🔗 <a href="${safeUrl}">Read Full News</a>`;
	
	await bot.api.sendMessage(env.TELEGRAM_CHANNEL_ID, message, {
		parse_mode: 'HTML',
		// Using the non-deprecated grammy configuration for web page previews
		link_preview_options: { is_disabled: false },
	});
};

import { Bot } from 'grammy';
import { Env } from '../types';

export const broadcastNews = async (env: Env, article: { title: string; summary: string; url: string }) => {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
	
	const message = `🟢 *${article.title}*\n\n💡 _${article.summary}_\n\n🔗 [Read Full News](${article.url})`;
	
	await bot.api.sendMessage(env.TELEGRAM_CHANNEL_ID, message, {
		parse_mode: 'Markdown',
		disable_web_page_preview: false,
	});
};

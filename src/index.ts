import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { postedLeads } from './schema';

export interface Env {
  DB: D1Database;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHANNEL_ID: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = drizzle(env.DB);
    const targetUrl = "https://cryptonews.com/news/tether-news/";

    // Initiate Crawl with AI extraction using JSON format
    const crawlPayload = {
      url: targetUrl,
      limit: 1,
      formats: ["json"],
      render: false,
      jsonOptions: {
        prompt: "Extract the top 3 latest news articles related to USDT or Web3 from this page. Provide the title, full URL, and a very short 1-sentence summary.",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "news_list",
            properties: {
              articles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                    summary: { type: "string" }
                  },
                  required: ["title", "url", "summary"]
                }
              }
            },
            required: ["articles"]
          }
        }
      }
    };

    const crawlInitRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(crawlPayload)
    });

    const initData = await crawlInitRes.json() as any;
    const jobId = initData.result;

    if (!jobId) return;

    // Poll for Completion
    let crawlData: any = null;
    for (let i = 0; i < 15; i++) {
      const statusRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}?limit=1`, {
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}` }
      });
      crawlData = await statusRes.json();
      
      if (crawlData.result?.status === 'completed') break;
      if (['errored', 'cancelled_due_to_limits', 'cancelled_due_to_timeout'].includes(crawlData.result?.status)) return;
      await new Promise(res => setTimeout(res, 5000));
    }

    // Process and Post to Telegram
    if (crawlData?.result?.records && crawlData.result.records.length > 0) {
      const record = crawlData.result.records[0];
      if (record.json) {
        try {
          const parsedData = JSON.parse(record.json);
          const articles = parsedData.articles || [];

          for (const article of articles) {
            const articleUrl = article.url.startsWith('http') ? article.url : `https://cryptonews.com${article.url}`;
            const existing = await db.select().from(postedLeads).where(eq(postedLeads.url, articleUrl)).get();
            
            if (!existing) {
              const message = `🟢 **${article.title}**\n\n💡 ${article.summary}\n\n🔗 [Read Full News](${articleUrl})\n\n📢 ${env.TELEGRAM_CHANNEL_ID}`;
              
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: env.TELEGRAM_CHANNEL_ID,
                  text: message,
                  parse_mode: 'Markdown',
                  disable_web_page_preview: false
                })
              });

              await db.insert(postedLeads).values({ url: articleUrl, title: article.title }).run();
            }
          }
        } catch (error) {
          console.error("JSON parsing or Telegram posting failed:", error);
        }
      }
    }
  }
};

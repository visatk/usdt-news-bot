import { Env } from '../types';

export const fetchCryptoNews = async (env: Env) => {
	const targetUrls = [
		'https://cryptonews.com/news/tether-news/',
		'https://cointelegraph.com/tags/tether',
		'https://www.coindesk.com/tag/tether/'
	];

	const allArticles: { title: string; url: string; summary: string }[] = [];

	for (const targetUrl of targetUrls) {
		const crawlPayload = {
			url: targetUrl,
			limit: 1, 
			formats: ['json'],
			render: false, 
			jsonOptions: {
				prompt: 'Extract the top 3 latest news articles related to USDT, Tether, or Web3 from this page. Provide the title, full absolute URL, and a very short 1-sentence summary.',
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'news_list',
						properties: {
							articles: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										title: { type: 'string' },
										url: { type: 'string' },
										summary: { type: 'string' },
									},
									required: ['title', 'url', 'summary'],
								},
							},
						},
						required: ['articles'],
					},
				},
			},
		};

		try {
			const initRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.CF_API_TOKEN}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(crawlPayload),
			});

			if (!initRes.ok) continue;

			const initData = (await initRes.json()) as any;
			const jobId = initData?.result;
			
			if (!jobId) continue;

			let isCompleted = false;
			for (let i = 0; i < 15; i++) {
				const statusRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}?limit=1`, {
					headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
				});
				
				if (!statusRes.ok) continue;

				const statusData = (await statusRes.json()) as any;
				const status = statusData.result?.status;

				if (status === 'completed') {
					isCompleted = true;
					break;
				}
				if (['errored', 'cancelled_due_to_limits', 'cancelled_due_to_timeout'].includes(status)) {
					console.error(`Crawl failed for ${targetUrl} with status: ${status}`);
					break;
				}
				
				// Standard, platform-compliant blocking approach for Cloudflare Workers
				await new Promise((resolve) => setTimeout(resolve, 5000));
			}

			if (isCompleted) {
				const fullRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}`, {
					headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
				});
				
				if (!fullRes.ok) continue;

				const crawlData = (await fullRes.json()) as any;

				// Safe extraction handling dynamically generated API responses
				if (crawlData?.result?.records?.[0]?.json) {
					try {
						const parsedData = JSON.parse(crawlData.result.records[0].json);
						const articles = parsedData.articles || [];
						
						const baseUrl = new URL(targetUrl).origin;
						const formattedArticles = articles.map((a: any) => ({
							...a,
							url: a.url?.startsWith('http') ? a.url : `${baseUrl}${a.url || ''}`
						})).filter((a: any) => a.title && a.url); // Drop malformed extractions

						allArticles.push(...formattedArticles);
					} catch (parseErr) {
						console.error(`JSON processing crashed for ${targetUrl}:`, parseErr);
					}
				}
			}
		} catch (error) {
			console.error(`Crawler network failure for ${targetUrl}:`, error);
		}
	}
	
	return allArticles;
};

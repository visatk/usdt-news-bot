import { Env } from '../types';

export const fetchCryptoNews = async (env: Env) => {
	const targetUrls = [
		'https://cryptonews.com/news/tether-news/',
		'https://cointelegraph.com/tags/tether',
		'https://www.coindesk.com/tag/tether/'
	];

	// Run crawl jobs in parallel to avoid Cloudflare Worker cron timeout limits
	const crawlPromises = targetUrls.map(async (targetUrl) => {
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

			if (!initRes.ok) return [];

			const initData = (await initRes.json()) as any;
			// FIX: Extract the actual job ID string from the Cloudflare API response object
			const jobId = initData?.result?.id; 
			
			if (!jobId) return [];

			let isCompleted = false;
			// Polling limit adjusted to balance between completion safety and edge timeouts
			for (let i = 0; i < 10; i++) {
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
				
				await new Promise((resolve) => setTimeout(resolve, 5000));
			}

			if (isCompleted) {
				const fullRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}`, {
					headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
				});
				
				if (!fullRes.ok) return [];

				const crawlData = (await fullRes.json()) as any;
				
				// Safely resolve the deeply nested JSON output based on Cloudflare's dynamic structure
				const jsonContent = crawlData?.result?.records?.[0]?.json || crawlData?.result?.json;

				if (jsonContent) {
					try {
						const parsedData = JSON.parse(jsonContent);
						const articles = parsedData.articles || [];
						
						const baseUrl = new URL(targetUrl).origin;
						return articles.map((a: any) => ({
							...a,
							url: a.url?.startsWith('http') ? a.url : `${baseUrl}${a.url || ''}`
						})).filter((a: any) => a.title && a.url); 
					} catch (parseErr) {
						console.error(`JSON processing crashed for ${targetUrl}:`, parseErr);
					}
				}
			}
		} catch (error) {
			console.error(`Crawler network failure for ${targetUrl}:`, error);
		}
		
		return [];
	});

	const results = await Promise.all(crawlPromises);
	return results.flat();
};

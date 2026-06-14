import { Env } from '../types';

// Cloudflare Workers এর গ্লোবাল scheduler টাইপ ডিক্লেয়ারেশন
declare const scheduler: { wait: (ms: number, options?: { signal?: AbortSignal }) => Promise<void> };

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
			limit: 1, // শুধু ইনডেক্স পেজ ক্রল করব
			formats: ['json'],
			render: false, // স্ট্যাটিক HTML ফেচ করে পারফরম্যান্স বাড়াবে
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
			// 1. Initiate the crawl job
			const initRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.CF_API_TOKEN}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(crawlPayload),
			});

			const initData = (await initRes.json()) as any;
			const jobId = initData?.result;
			
			if (!jobId) {
				console.error(`Crawl initiation failed for ${targetUrl}:`, initData);
				continue;
			}

			// 2. Poll for Completion with limit=1 to keep response lightweight
			let isCompleted = false;
			for (let i = 0; i < 15; i++) {
				const statusRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}?limit=1`, {
					headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
				});
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
				
				// Using scheduler.wait instead of setTimeout (Cloudflare Best Practice)
				await scheduler.wait(5000); 
			}

			// 3. Fetch the full results WITHOUT the limit parameter after completion
			if (isCompleted) {
				const fullRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}`, {
					headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
				});
				const crawlData = (await fullRes.json()) as any;

				if (crawlData?.result?.records && crawlData.result.records.length > 0) {
					// since limit was 1 in payload, records[0] contains the data
					const record = crawlData.result.records[0];
					if (record.json) {
						const parsedData = JSON.parse(record.json);
						const articles = parsedData.articles || [];
						
						const baseUrl = new URL(targetUrl).origin;
						const formattedArticles = articles.map((a: any) => ({
							...a,
							url: a.url.startsWith('http') ? a.url : `${baseUrl}${a.url}`
						}));

						allArticles.push(...formattedArticles);
					}
				}
			}
		} catch (error) {
			console.error(`Crawler API error for ${targetUrl}:`, error);
		}
	}
	
	return allArticles;
};

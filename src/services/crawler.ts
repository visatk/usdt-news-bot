import { Env } from '../types';

export const fetchCryptoNews = async (env: Env) => {
	// 🎯 এখানে আপনি চাইলে ভবিষ্যতে আরও সাইট অ্যাড করতে পারেন
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

			const initData = (await initRes.json()) as any;
			const jobId = initData?.result;
			
			if (!jobId) {
				console.error(`Crawl initiation failed for ${targetUrl}:`, initData);
				continue; // ফেইল হলে পরের সাইটে যাবে
			}

			let crawlData: any = null;
			for (let i = 0; i < 15; i++) {
				const statusRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}?limit=1`, {
					headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
				});
				crawlData = await statusRes.json();

				if (crawlData.result?.status === 'completed') break;
				if (['errored', 'cancelled_due_to_limits', 'cancelled_due_to_timeout'].includes(crawlData.result?.status)) {
					console.error(`Crawl failed for ${targetUrl} with status: ${crawlData.result?.status}`);
					break;
				}
				await new Promise((res) => setTimeout(res, 5000));
			}

			if (crawlData?.result?.records && crawlData.result.records.length > 0) {
				const record = crawlData.result.records[0];
				if (record.json) {
					const parsedData = JSON.parse(record.json);
					const articles = parsedData.articles || [];
					
					// URL ফিক্সিং: রিলেটিভ URL থাকলে ডাইনামিক বেস URL যুক্ত করবে
					const baseUrl = new URL(targetUrl).origin;
					const formattedArticles = articles.map((a: any) => ({
						...a,
						url: a.url.startsWith('http') ? a.url : `${baseUrl}${a.url}`
					}));

					allArticles.push(...formattedArticles);
				}
			}
		} catch (error) {
			console.error(`Crawler API error for ${targetUrl}:`, error);
		}
	}
	
	return allArticles;
};

import { Env } from '../types';

export const fetchCryptoNews = async (env: Env) => {
	const targetUrl = 'https://cryptonews.com/news/tether-news/';

	const crawlPayload = {
		url: targetUrl,
		limit: 1,
		formats: ['json'],
		render: false,
		jsonOptions: {
			prompt: 'Extract the top 3 latest news articles related to USDT or Web3 from this page. Provide the title, full URL, and a very short 1-sentence summary.',
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

	// 1. Initiate Crawl
	const initRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.CF_API_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(crawlPayload),
	});

	const initData = (await initRes.json()) as any;
	const jobId = initData.result;
	if (!jobId) throw new Error('Crawl initiation failed');

	// 2. Poll for Completion (Max 15 attempts)
	let crawlData: any = null;
	for (let i = 0; i < 15; i++) {
		const statusRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/crawl/${jobId}?limit=1`, {
			headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
		});
		crawlData = await statusRes.json();

		if (crawlData.result?.status === 'completed') break;
		if (['errored', 'cancelled_due_to_limits', 'cancelled_due_to_timeout'].includes(crawlData.result?.status)) {
			throw new Error(`Crawl failed with status: ${crawlData.result?.status}`);
		}
		await new Promise((res) => setTimeout(res, 5000));
	}

	// 3. Extract and Return Data
	if (crawlData?.result?.records && crawlData.result.records.length > 0) {
		const record = crawlData.result.records[0];
		if (record.json) {
			const parsedData = JSON.parse(record.json);
			return parsedData.articles || [];
		}
	}
	return [];
};

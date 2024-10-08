import { Data, Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import parser from '@/utils/rss-parser';

export const route: Route = {
    path: '/',
    name: '煎蛋首页资讯',
    example: '/',
    maintainers: ['nczitzk', 'bigfei'],
    handler,
};

async function handler() {
    const rootUrl = 'https://jandan.net';
    const feed = await parser.parseURL(`${rootUrl}/feed/`);
    const items = await Promise.all(
        feed.items
            // filter AD
            .filter(({ title }) => !(title || '').includes('今日好价'))
            .map((item) =>
                cache.tryGet(item.link!, async () => {
                    const response = await got(item.link);
                    const $ = load(response.data);
                    $('.wechat-hide').prev().nextAll().remove();
                    return {
                        title: item.title,
                        description: $('.entry').html(),
                        pubDate: item.pubDate,
                        link: item.link,
                        author: item['dc:creator'],
                        category: item.categories,
                    };
                })
            )
    );
    return {
        title: '资讯 - 煎蛋',
        link: 'https://jandan.net',
        item: items,
    } as Data;
}

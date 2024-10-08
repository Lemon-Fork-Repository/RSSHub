import { Data, DataItem, Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { trimTitleDesc } from '@/routes/jandan/utils';
import type { Context } from 'hono';

export const route: Route = {
    path: '/:category',
    example: '/top',
    name: '煎蛋分类',
    maintainers: ['lemon'],
    handler,
    description: `妹子图和 BBS 不支持此路由`,
    parameters: {
        category: {
            description: '分类',
            default: 'top',
            options: [
                { value: 'qa', label: '问答' },
                { value: 'treehole', label: '树洞' },
                {
                    value: 'ooxx',
                    label: '随手拍',
                },
                { value: 'pic', label: '无聊图' },
                { value: 'top', label: '煎蛋热门内容排行榜' },
                {
                    value: 'top-4h',
                    label: '四小时热门',
                },
                { value: 'top-tucao', label: '集合24小时内最棒的吐槽' },
                {
                    value: 'top-ooxx',
                    label: '热榜 - 随手拍',
                },
                { value: 'top-comments', label: '热榜 - 树洞' },
                {
                    value: 'top-3days',
                    label: '煎蛋内容三日热榜',
                },
                { value: 'top-7days', label: '煎蛋内容七日热榜' },
            ],
        },
    },
};
const rootUrl = 'https://i.jandan.net';
const webUrl = 'https://jandan.net';

async function handler(ctx: Context) {
    const category = ctx.req.param('category') ?? 'top';

    const currentUrl = `${rootUrl}/${category}`;

    const { items, title } = await crawl(currentUrl, ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')!) : 30, category, []);

    return {
        title: `${title} - 煎蛋`,
        link: `${webUrl}/${category}`,
        item: items,
    } as Data;
}

async function crawl(url: string, limit: number, title: string, items: DataItem[]) {
    if (items.length >= limit) {
        return { items, title };
    }
    const response = await got({
        method: 'get',
        url,
    });

    const $ = load(response.data);

    const new_item = $('ol.commentlist li')
        .not('.row')
        .toArray()
        .map((e) => {
            const item = $(e);

            // item.find('.commenttext img, .tucao-report').remove();

            const author = item.find('b').first().text();
            const description = item.find('.commenttext');

            return {
                author,
                description: description.html(),
                title: trimTitleDesc(author, description.text()),
                pubDate: parseDate(item.find('.time').text()),
                link: `${webUrl}/t/${item.attr('id')!.split('-').pop()}`,
            } as DataItem;
        });
    items.push(...new_item);
    title = $('title').text();

    const nextUrl = $('a.previous-comment-page').attr('href');
    if (nextUrl) {
        return crawl(`https:${nextUrl}`, limit, title, items);
    }
    return {
        items,
        title,
    };
}

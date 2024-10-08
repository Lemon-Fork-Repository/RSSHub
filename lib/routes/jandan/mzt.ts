import { Data, DataItem, Route, ViewType } from '@/types';
import got from '@/utils/got';
import { Context } from 'hono';

export const route: Route = {
    path: '/mzt',
    name: '煎蛋妹子图',
    example: '/mzt',
    maintainers: ['lemon'],
    handler,
    view: ViewType.Pictures,
};

async function handler(ctx: Context): Promise<Data> {
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')!) : 30;

    const items = await crawl(undefined, limit, []);

    return {
        title: '妹子图 - 煎蛋',
        link: 'https://jandan.net/mzt',
        item: items,
    };
}

async function crawl(start_id?: string, limit: number = 30, items: DataItem[] = []): Promise<DataItem[]> {
    if (items.length >= limit) {
        return items;
    }

    const response = await got(`https://api.jandan.net/api/v1/comment/list/108629${start_id ? `?start_id=${start_id}` : ''}`, { responseType: 'json' });
    const data: {
        id: string;
        author: string;
        date: string;
        vote_positive: string;
        vote_negative: string;
        images: { url: string; full_url: string }[];
    }[] = response.data.data;

    const res_data = data.map(
        (item) =>
            ({
                title: item.author,
                description: item.images.map((image) => `<p><a href="${image.full_url}">[查看原图]</a><br><img alt="原图" src="${image.url}" referrerpolicy="no-referrer" /></p>`).join(''),
                pubDate: new Date(item.date),
                link: `https://jandan.net/t/${item.id}`,
                author: item.author,
            }) as DataItem
    );
    const last_id = data?.at(-1)?.id;
    if (last_id) {
        return crawl(last_id, limit, [...items, ...res_data]);
    }
    return [...items, ...res_data];
}

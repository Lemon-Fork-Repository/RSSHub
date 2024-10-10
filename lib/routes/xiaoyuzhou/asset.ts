import { Data, Route } from '@/types';
import { authFetch } from '@/routes/xiaoyuzhou/utils';
import { parseDate } from '@/utils/parse-date';
import logger from '@/utils/logger';
import cache from '@/utils/cache';
import { Context } from 'hono';

export const route: Route = {
    path: '/asset',
    example: '/asset',
    name: '已购内容',
    maintainers: ['lemon'],
    handler,
    url: 'xiaoyuzhoufm.com/',
};

type Asset = {
    eid: string;
    title: string;
    enclosure: {
        url: string;
    };
    duration: number;
    pubDate: string;
    shownotes: string;
    podcast: {
        image: {
            smallPicUrl: string;
        };
    };
    isPrivateMedia: boolean;
    trail: {
        segment: string;
    };
};

export async function handler(ctx: Context) {
    const res = await authFetch('https://api.xiaoyuzhoufm.com/v1/asset/list', 'post');
    ctx.set('json', res);
    const data: Asset[] | null = res?.data;

    const items = await Promise.all(
        data?.map(async (item) => {
            let media_url = item.enclosure.url;
            if (item.isPrivateMedia) {
                try {
                    const api = `https://api.xiaoyuzhoufm.com/v1/private-media/get?eid=${item.eid}`;
                    const media: any = await cache.tryGet(api, () => authFetch(api), 14400);
                    media_url = media!.data!.url;
                } catch (error) {
                    logger.error((error as Error).message);
                    media_url = item.trail.segment;
                }
            }

            return {
                title: item.title,
                enclosure_url: media_url,
                itunes_duration: item.duration,
                enclosure_type: 'audio/mpeg',
                link: `https://www.xiaoyuzhoufm.com/episode/${item.eid}`,
                pubDate: parseDate(item.pubDate),
                description: item.shownotes,
                itunes_item_image: item.podcast?.image?.smallPicUrl,
            };
        }) || []
    );

    return {
        title: '小宇宙 - 已购内容',
        link: 'https://www.xiaoyuzhoufm.com/',
        description: '小宇宙付费账户中的已购内容',
        image: 'https://www.xiaoyuzhoufm.com/apple-touch-icon.png',
        itunes_author: '小宇宙',
        itunes_category: 'Society & Culture',
        allowEmpty: true,
        item: items,
    } as Data;
}

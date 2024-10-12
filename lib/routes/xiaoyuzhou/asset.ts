import { Data, Route } from '@/types';
import { authFetch, getEpisodeMedia } from './utils';
import { Asset } from './types';
import { parseDate } from '@/utils/parse-date';
import { Context } from 'hono';

export const route: Route = {
    path: '/asset',
    example: '/asset',
    name: '已购内容',
    maintainers: ['lemon'],
    handler,
    url: 'xiaoyuzhoufm.com/',
};

export async function handler(ctx: Context) {
    const res = await authFetch('https://api.xiaoyuzhoufm.com/v1/asset/list', { method: 'post' });
    ctx.set('json', res);
    const data: Asset[] | null = res?.data;

    const items = await Promise.all(
        data?.map(async (item) => ({
            title: item.title,
            enclosure_url: await getEpisodeMedia(item),
            itunes_duration: item.duration,
            enclosure_type: 'audio/mpeg',
            link: `https://www.xiaoyuzhoufm.com/episode/${item.eid}`,
            pubDate: parseDate(item.pubDate),
            description: item.shownotes,
            itunes_item_image: item.podcast?.image?.smallPicUrl,
        })) || []
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

import { Data, Route, ViewType } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { Context } from 'hono';

export const route: Route = {
    path: '/podcast/:id',
    categories: ['multimedia', 'popular'],
    view: ViewType.Audios,
    example: '/xiaoyuzhou/podcast/6021f949a789fca4eff4492c',
    parameters: { id: '播客id，可以在小宇宙播客的 URL 中找到' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['xiaoyuzhoufm.com/podcast/:id'],
        },
    ],
    name: '播客节目',
    maintainers: ['hondajojo', 'jtsang4'],
    handler,
    url: 'xiaoyuzhoufm.com/',
};

async function handler(ctx: Context) {
    const link = `https://www.xiaoyuzhoufm.com/podcast/${ctx.req.param('id')}`;
    const response = await got(link);

    const $ = load(response.data);

    const page_data = JSON.parse($('#__NEXT_DATA__').text());

    ctx.set('json', page_data);

    const podcast = page_data.props.pageProps.podcast;

    const episodes =
        podcast?.episodes?.map((item) => ({
            title: item.title,
            enclosure_url: item.enclosure.url,
            itunes_duration: item.duration,
            enclosure_type: 'audio/mpeg',
            link: `https://www.xiaoyuzhoufm.com/episode/${item.eid}`,
            pubDate: parseDate(item.pubDate),
            description: item.shownotes,
            itunes_item_image: (item.image || item.podcast?.image)?.smallPicUrl,
        })) || [];

    return {
        title: podcast?.title,
        link: `https://www.xiaoyuzhoufm.com/podcast/${podcast?.pid}`,
        itunes_author: podcast?.author,
        itunes_category: '',
        image: podcast?.image.smallPicUrl,
        item: episodes,
        description: podcast?.description,
        allowEmpty: true,
    } as Data;
}

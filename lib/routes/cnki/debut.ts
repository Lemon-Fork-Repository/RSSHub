import { Data, DataItem, Route } from '@/types';
import { generateGuid } from '@/routes/cnki/utils';
import parser from '@/utils/rss-parser';
import { Context } from 'hono';

export const route: Route = {
    path: '/journals/debut/:name',
    categories: ['journal'],
    example: '/cnki/journals/debut/LKGP',
    parameters: { name: '期刊缩写，可以在网址中得到' },
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
            source: ['navi.cnki.net/knavi/journals/:name/detail'],
        },
    ],
    name: '网络首发',
    maintainers: ['Fatpandac'],
    handler,
};

async function handler(ctx: Context) {
    return await handleRss(ctx);
}

async function handleRss(ctx: Context) {
    const name = ctx.req.param('name');

    // https://rss.cnki.net/kns/rss.aspx?Journal=LKGP&Virtual=knavi
    // https://navi.cnki.net/knavi/rss/LKGP
    const string = await fetch(`https://rss.cnki.net/kns/rss.aspx?Journal=${name}&Virtual=knavi`).then((res) => res.text());
    const feed = await parser.parseString(string);
    ctx.set('json', feed);

    const items = feed.items.map(
        (item) =>
            ({
                title: item.title,
                link: item.link,
                author: item.creator,
                description: item.content,
                pubDate: item.pubDate, // fixme: `pubDate` is not journal publish date
                guid: generateGuid(name + item.title),
            }) as DataItem
    );

    return {
        title: `全网首发 - ${feed.title}`,
        description: feed.description,
        link: feed.link,
        allowEmpty: true,
        image: feed.image?.url,
        item: items,
    } as Data;
}

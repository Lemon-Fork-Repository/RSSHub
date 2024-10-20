import { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { generateGuid, ProcessItem } from '@/routes/cnki/utils';
import parser from '@/utils/rss-parser';
import logger from '@/utils/logger';
import { Context } from 'hono';

const rootUrl = 'https://kns.cnki.net';

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
    const new_way = ctx.req.query('new');
    if (new_way) {
        try {
            // using cnki rss link
            return await handleRss(ctx);
        } catch (error) {
            logger.error('网络首发', { message: error });
            // downgrade to old method
            return await handleApi(ctx);
        }
    } else {
        return await handleApi(ctx);
    }
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

async function handleApi(ctx: Context) {
    const name = ctx.req.param('name');
    const journalUrl = `${rootUrl}/knavi/journals/${name}/detail`;
    const title = await got.get(journalUrl).then((res) => load(res.data)('head > title').text());

    const outlineUrl = `${rootUrl}/knavi/journals/${name}/papers/outline`;
    const response = await got({
        method: 'post',
        url: outlineUrl,
        form: {
            pageIdx: '0',
            type: '2',
            pcode: 'CJFD',
            epub: 0,
        },
    });
    const $ = load(response.data);
    const list = $('dd')
        .toArray()
        .map((item) => {
            const a_ele = $(item).find('span.name > a');
            const title = a_ele.text().trim();
            return {
                title,
                link: a_ele.attr('href'),
                pubDate: parseDate($(item).find('span.company').text(), 'YYYY-MM-DD HH:mm:ss'),
                guid: generateGuid(name + title),
            } as DataItem;
        });

    const items = await Promise.all(list.map((item) => cache.tryGet(item.guid!, () => ProcessItem(item))));

    return {
        title: `${title} - 全网首发`,
        link: `https://navi.cnki.net/knavi/journals/${name}/detail`,
        allowEmpty: true,
        item: items,
    } as Data;
}

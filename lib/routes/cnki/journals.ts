import { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { generateGuid, ProcessItem } from './utils';
import puppeteer from '@/utils/puppeteer';

// navi need puppeteer
const rootUrl = 'https://navi.cnki.net';

export const route: Route = {
    path: '/journals/:name',
    categories: ['journal'],
    example: '/cnki/journals/LKGP',
    parameters: { name: '期刊缩写，可以在网址中得到' },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
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
    name: '期刊',
    maintainers: ['Fatpandac', 'Derekmini'],
    handler,
};

async function handler(ctx) {
    const name = ctx.req.param('name');
    const journalUrl = `${rootUrl}/knavi/journals/${name}/detail`;

    const browser = await puppeteer({ stealth: true });
    const page = await browser.newPage();
    // wait for page load
    await Promise.all([page.waitForSelector('.yearissuepage dt'), page.goto(journalUrl)]);
    // click the latest year, and wait for the content to load
    await Promise.all([page.click('.yearissuepage dt'), page.waitForSelector('#CataLogContent dd')]);
    const cookies = await page.cookies().then((cookies) => cookies.map((c) => `${c.name}=${c.value}`).join('; '));
    const content = await page.content();

    await page.close();

    const $ = load(content);
    const title = $('head > title').text();

    const date = parseDate($('.yearissuepage > dl > dd > a').attr('id')?.replace('yq', '') || '', 'YYYYMM');
    const publications = $('#CataLogContent dd');

    const list: DataItem[] = publications.toArray().map((publication) => {
        const title = $(publication).find('a').first().text();
        const link = $(publication).find('a').attr('href');
        const author = $(publication).find('span.author').text();

        return {
            title,
            link,
            author,
            pubDate: date,
            guid: generateGuid(title + name),
        } as DataItem;
    });

    const items = await Promise.all(list.map((item) => cache.tryGet(item.guid!, () => ProcessItem(item, cookies))));

    return {
        title: `期刊 - ${title}`,
        link: journalUrl,
        item: items,
    } as Data;
}

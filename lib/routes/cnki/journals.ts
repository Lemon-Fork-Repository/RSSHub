import { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { generateGuid, ProcessItem } from './utils';
import logger from '@/utils/logger';

const rootUrl = 'https://navi.cnki.net';

export const route: Route = {
    path: '/journals/:name',
    categories: ['journal'],
    example: '/cnki/journals/LKGP',
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
    name: '期刊',
    maintainers: ['Fatpandac', 'Derekmini'],
    handler,
};

async function handler(ctx) {
    const name = ctx.req.param('name');
    const journalUrl = `${rootUrl}/knavi/journals/${name}/detail`;
    const journalDetail = await got(journalUrl);
    const $j = load(journalDetail.data);
    const title = $j('head > title').text();
    const time = $j('#time').attr()?.value;
    const yearListUrl = `${rootUrl}/knavi/journals/${name}/yearList`;

    logger.info(`title: ${title}, time: ${time}`);

    const { code, date } = await got
        .post(yearListUrl, {
            form: {
                pIdx: 0,
                time,
            },
        })
        .then((res) => {
            const $ = load(res.data);
            const code = $('.yearissuepage').find('dl').first().find('dd').find('a').first().attr('value');
            const date = parseDate($('.yearissuepage > dl > dd > a').attr('id')?.replace('yq', '') || '', 'YYYYMM');
            return { code, date };
        });
    logger.info(`code: ${code}, date: ${date}`);

    const yearIssueUrl = `${rootUrl}/knavi/journals/${name}/papers?yearIssue=${code}&pageIdx=0&pcode=CJFD,CCJD`;
    const response = await got.post(yearIssueUrl);

    const $ = load(response.data);
    const publications = $('dd');

    const now = new Date();
    const list: DataItem[] = publications
        .map((_, publication) => {
            const title = $(publication).find('a').first().text();
            const link = $(publication).find('a').attr('href');
            const author = $(publication).find('span.author').text();

            return {
                title,
                link,
                author,
                pubDate: date,
                updated: now,
                guid: generateGuid(title + name),
            } as DataItem;
        })
        .get();

    const items = await Promise.all(list.map((item) => cache.tryGet(item.guid!, () => ProcessItem(item))));

    return {
        title: `期刊 ${title}`,
        link: journalUrl,
        item: items,
    } as Data;
}

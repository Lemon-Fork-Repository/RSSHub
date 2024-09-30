import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { ProcessItem } from './utils';

const rootUrl = 'https://kns.cnki.net';

export const route: Route = {
    path: '/author/:v',
    categories: ['journal'],
    example: '/cnki/author/KqXyGY4RJv3vDj-T0lsHgLz0TF-lQcv7oV5b_ya7VBbAwNiDNufbC8Qxcgy0pBOUJ46yC5F3j3bJFPdRLsjdiTAS2Xmi12cGWo7qKklOUj2izJqUS-wfL4GKU7aZv0o-',
    parameters: { code: '作者详情页对应value，可以在网址中得到' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '作者期刊文献',
    description: `:::tip
    可能仅限中国大陆服务器访问，以实际情况为准。
    :::`,
    maintainers: ['harveyqiu', 'Derekmini'],
    handler,
};

async function handler(ctx) {
    const v_code = ctx.req.param('v');
    const author_detail_url = `${rootUrl}/kcms2/author/detail?v=${v_code}`;
    const res = await got.get(author_detail_url);
    const $ = load(res.data);
    const author_name = $('#showname').text();
    const company_name = $('#kcms-author-info > h3:nth-child(5) > span > a').text();

    const url = `${rootUrl}/restapi/knowledge-api/v1/experts/relations/resources?v=${v_code}&sequence=PT&size=10&sort=desc&start=1&resource=CJFD`;

    const res3 = await got(url);
    const publications = res3.data.data.data;

    const list = publications.map((publication) => {
        const metadata = publication.metadata;
        const { value: title = '' } = metadata.find((md) => md.name === 'TI') || {};
        const { value: date = '' } = metadata.find((md) => md.name === 'PT') || {};
        const { url: link = '' } = publication.relations.find((rel) => rel.scope === 'ABSTRACT') || {};

        return {
            title,
            link,
            author: author_name,
            pubDate: date,
        };
    });

    const items = await Promise.all(list.map((item) => cache.tryGet(item.link, () => ProcessItem(item))));

    return {
        title: `知网 ${author_name} ${company_name}`,
        link: author_detail_url,
        item: items,
    };
}

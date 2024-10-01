import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { hashCode, ProcessItem } from './utils';
import logger from '@/utils/logger';
import { load } from 'cheerio';

const rootUrl = 'https://kns.cnki.net';

export const route: Route = {
    path: '/author/:code/:name',
    categories: ['journal'],
    example: '/cnki/author/000037748936/王利明',
    parameters: { code: '作者对应au-code，可以在网址中得到', name: '作者的姓名, 包含匹配' },
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
    const { code, name } = ctx.req.param();

    const res = await got.post('https://kns.cnki.net/kns8s/brief/grid', {
        form: {
            QueryJson: `{"Platform":"","Resource":"CROSSDB","Classid":"WD0FTY92","Products":"","QNode":{"QGroup":[{"Key":"Subject","Title":"","Logic":0,"Items":[{"Key":"Expert","Title":"","Logic":0,"Field":"EXPERT","Operator":0,"Value":"AUC=${code}","Value2":""}],"ChildItems":[]},{"Key":"ControlGroup","Title":"","Logic":0,"Items":[],"ChildItems":[]}]},"ExScope":"1","SearchType":4,"Rlang":"CHINESE","KuaKuCode":"YSTT4HG0,LSTPFY1C,JUP3MUPD,MPMFIG1A,EMRPGLPA,WQ0UVIAA,BLZOG7CK,PWFIRAGL,NN3FJMUV,NLBO1Z6R","SearchFrom":1}`,
        },
        headers: {
            Referer: 'https://kns.cnki.net/kns8s/AdvSearch?classid=WD0FTY92',
        },
    });

    const $ = load(res.data);
    const $author = $(`.KnowledgeNetLink:contains("${name}"):first`);
    const author_detail_link = $author.attr('href');
    const regex = /v=([^&]+)/;
    const v_code = author_detail_link!.match(regex)![1];

    const { author_name, company_name } = await got('https://kns.cnki.net/restapi/knowledge-api/v1/experts/detail?v=' + v_code).then((data) => {
        const detail = data.data.data;
        const { value: author_name = '' } = detail.metadata.find((md) => md.name === 'NAME') || {};
        const { value: company_name = '' } = detail.metadata.find((md) => md.name === 'ORG') || {};
        return {
            author_name,
            company_name,
        };
    });

    logger.info(`author_name: ${author_name}, company_name: ${company_name}`);

    const url = `${rootUrl}/restapi/knowledge-api/v1/experts/relations/resources?v=${v_code}&sequence=PT&size=10&sort=desc&start=1&resource=CJFD`;

    const res3 = await got(url);
    const publications = res3.data.data.data;

    const list = publications.map((publication) => {
        const metadata = publication.metadata;
        const { value: title = '' } = metadata.find((md) => md.name === 'TI') || {};
        const { value: date = '' } = metadata.find((md) => md.name === 'PT') || {};
        const { url: link = '' } = publication.relations.find((rel) => rel.scope === 'ABSTRACT') || {};
        const { url: itunes_item_image = '' } = publication.source.relations.find((rel) => rel.scope === 'COVER') || {};

        return {
            title,
            link,
            author: author_name,
            pubDate: date,
            itunes_item_image,
            guid: hashCode(title + author_name),
        };
    });

    const items = await Promise.all(list.map((item) => cache.tryGet(item.link, () => ProcessItem(item))));

    return {
        title: `知网 ${author_name} ${company_name}`,
        link: author_detail_link,
        item: items,
    };
}

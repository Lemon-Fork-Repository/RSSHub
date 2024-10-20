import { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { generateGuid, ProcessItem } from './utils';
import logger from '@/utils/logger';
import { CheerioAPI, load } from 'cheerio';
import { Context } from 'hono';

const rootUrl = 'https://kns.cnki.net';

export const route: Route = {
    path: '/author/:code/:name?',
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

async function handler(ctx: Context) {
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
    const regex = /v=([^&]+)/;
    let author_name: string, company_name: string, v_code: string;

    if (name) {
        const __ret = await findByName($, name, regex);
        v_code = __ret.v_code;
        author_name = __ret.author_name;
        company_name = __ret.company_name;
    } else {
        // downgrade to loop all authors
        const cached_author_name = await cache.get(`cnki:author:${code}`);
        const __ret = await (cached_author_name ? findByName($, cached_author_name, regex) : findByCode($, regex, code));
        author_name = __ret.author_name;
        company_name = __ret.company_name;
        v_code = __ret.v_code;
    }

    logger.info(`author_name: ${author_name}, company_name: ${company_name}, v_code: ${v_code}`);

    const url = `${rootUrl}/restapi/knowledge-api/v1/experts/relations/resources?v=${v_code}&sequence=PT&size=10&sort=desc&start=1&resource=CJFD`;

    const res3 = await got(url);
    const publications = res3.data.data.data;

    const now = new Date();
    const list: DataItem[] = publications.map((publication: any) => {
        const metadata = publication.metadata;
        const { value: title = '' } = metadata.find((md: any) => md.name === 'TI') || {};
        const { value: date = '' } = metadata.find((md: any) => md.name === 'PT') || {};
        const { url: link = '' } = publication.relations.find((rel: any) => rel.scope === 'ABSTRACT') || {};
        const { url: itunes_item_image = '' } = publication.source.relations.find((rel: any) => rel.scope === 'COVER') || {};

        return {
            title,
            link,
            author: author_name,
            pubDate: date,
            itunes_item_image,
            updated: now,
            guid: generateGuid(title + author_name),
        };
    });

    const items = await Promise.all(list.map((item) => cache.tryGet(item.guid!, () => ProcessItem(item))));

    return {
        title: `知网 ${author_name} ${company_name}`,
        link: `${rootUrl}/kcms2/author/detail?v=${v_code}&uniplatform=NZKPT&language=CHS`,
        item: items,
    } as Data;
}

async function findByName($: CheerioAPI, name: string, regex: RegExp) {
    const $author = $(`.KnowledgeNetLink:contains("${name}"):first`);
    const author_detail_link = $author.attr('href');
    const v_code = author_detail_link!.match(regex)![1];

    const datum = await got('https://kns.cnki.net/restapi/knowledge-api/v1/experts/detail?v=' + v_code).then((data) => {
        const detail = data.data.data;
        const { value: author_name = '' } = detail.metadata.find((md: any) => md.name === 'NAME') || {};
        const { value: company_name = '' } = detail.metadata.find((md: any) => md.name === 'ORG') || {};
        return {
            author_name,
            company_name,
        };
    });
    return { v_code, author_name: datum.author_name, company_name: datum.company_name };
}

async function findByCode($: CheerioAPI, regex: RegExp, code: string) {
    const v_codes = $('.author')
        .find('a')
        .toArray()
        .map((author) => author.attribs.href)
        .map((link) => link!.match(regex)![1]);

    const results = await Promise.all(v_codes.map(async (code) => await got('https://kns.cnki.net/restapi/knowledge-api/v1/experts/detail?v=' + code).then((data) => data.data.data)));
    const datum = results
        .filter((detail) => detail.metadata.find((md: any) => md.name === 'CODE')?.value === code)
        .map((detail) => {
            const { value: author_name = '' } = detail.metadata.find((md: any) => md.name === 'NAME') || {};
            const { value: company_name = '' } = detail.metadata.find((md: any) => md.name === 'ORG') || {};
            const { url: abstract_url = '' } = detail.relations.find((md: any) => md.scope === 'ABSTRACT') || {};
            return {
                author_name,
                company_name,
                v_code: abstract_url!.match(regex)![1],
            };
        })[0]!;

    const v_code = datum.v_code;
    const author_name = datum.author_name;
    const company_name = datum.company_name;
    cache.set(`cnki:author:${code}`, author_name, 3600 * 24 * 7);
    return { author_name, company_name, v_code };
}

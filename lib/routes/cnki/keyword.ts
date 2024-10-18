import { Data, DataItem, Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import cache from '@/utils/cache';
import { generateGuid, ProcessItem } from '@/routes/cnki/utils';
import { Context } from 'hono';

export const route: Route = {
    path: '/keyword/:keyword',
    categories: ['journal'],
    example: '/cnki/keyword/室内设计',
    parameters: {
        keyword: '关键词期刊监控',
        categories: '来源类别, SI: SCI来源期刊, EI: EI来源期刊, HX: 北大核心, CSI: CSSCI, CSD: CSCD, AMI: AMI, 多选使用,逗号分隔, 不填默认',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '关键词',
    maintainers: ['Lemon'],
    handler,
};

const map_type: Record<string, string> = {
    SI: 'SCI',
    EI: 'EI',
    HX: '北大核心',
    CSI: 'CSSCI',
    CSD: 'CSCD',
    AMI: 'AMI',
};

const rootUrl = 'https://kns.cnki.net';

async function handler(ctx: Context): Promise<Data> {
    const { keyword } = ctx.req.param();
    const categories = ctx.req.queries('categories');

    const query_json = assembleQueryJson(keyword, categories);
    ctx.set('json', query_json);

    const categories_str = categories ? '  来源类别：' + categories.map((category: string) => map_type[category]).join(',') + '; ' : '';

    const res = await got.post(`${rootUrl}/kns8s/brief/grid`, {
        headers: {
            Referer: 'https://kns.cnki.net/kns8s/AdvSearch',
        },
        form: {
            boolSearch: false,
            QueryJson: JSON.stringify(query_json, null, -1),
            pageNum: 1,
            pageSize: 20,
            sortField: 'PT',
            sortType: 'desc',
            dstyle: 'listmode',
            boolSortSearch: 'false',
            aside: '',
            searchFrom: `资源范围：学术期刊;  中英文扩展;  时间范围：更新时间：不限;${categories_str}`,
        },
    });

    const $ = load(res.data);
    const list = $('#gridTable tbody tr')
        .toArray()
        .map((data) => {
            const row = $(data);
            const title = row.find('.name > a').text();
            const link = row.find('.name > a').attr('href') || '';
            const author_name = row.find('.author').text();
            const date = row.find('.date').text();

            return {
                title,
                link,
                author: author_name,
                pubDate: date,
                guid: generateGuid(title + author_name),
            } as DataItem;
        });

    const items = await Promise.all(list.map((item) => cache.tryGet(item.guid!, () => ProcessItem(item))));

    return {
        title: `知网 - ${keyword}` + (categories ? ` - ${categories}` : ''),
        link: `${rootUrl}/kns8s/AdvSearch`,
        allowEmpty: true,
        item: items,
    } as Data;
}

function assembleQueryJson(keyword: string, categories: string[] | undefined) {
    let groups: any =
        categories?.map((category: string, index: number) => ({
            Key: index,
            Title: map_type[category],
            Logic: 1,
            Field: category,
            Operator: 'DEFAULT',
            Value: 'Y',
            Value2: '',
        })) || [];

    if (groups.length !== 0) {
        groups = [
            {
                Key: '.extend-tit-checklist',
                Title: '',
                Logic: 0,
                Items: [...groups],
                ChildItems: [],
            },
        ];
    }

    return {
        Platform: '',
        Resource: 'JOURNAL',
        Classid: 'YSTT4HG0',
        Products: '',
        QNode: {
            QGroup: [
                {
                    Key: 'Subject',
                    Title: '',
                    Logic: 0,
                    Items: [],
                    ChildItems: [
                        {
                            Key: 'input[data-tipid=gradetxt-1]',
                            Title: '关键词',
                            Logic: 0,
                            Items: [
                                {
                                    Key: 'input[data-tipid=gradetxt-1]',
                                    Title: '关键词',
                                    Logic: 0,
                                    Field: 'KY',
                                    Operator: 'DEFAULT',
                                    Value: String(keyword),
                                    Value2: '',
                                },
                            ],
                            ChildItems: [],
                        },
                    ],
                },
                {
                    Key: 'ControlGroup',
                    Title: '',
                    Logic: 0,
                    Items: [],
                    ChildItems: [...groups],
                },
            ],
        },
        ExScope: '1',
        SearchType: 1,
        Rlang: 'CHINESE',
        KuaKuCode: '',
        View: 'changeDBCh',
        SearchFrom: 1,
    };
}

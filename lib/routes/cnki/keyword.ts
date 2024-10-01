import { Route } from '@/types';
import logger from '@/utils/logger';
import got from '@/utils/got';
import { load } from 'cheerio';
import cache from '@/utils/cache';
import { hashCode, ProcessItem } from '@/routes/cnki/utils';

export const route: Route = {
    path: '/keyword/:keyword/:categories?',
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

const map_type = {
    SI: 'SCI来源期刊',
    EI: 'EI来源期刊',
    HX: '北大核心',
    CSI: 'CSSCI',
    CSD: 'CSCD',
    AMI: 'AMI',
};

async function handler(ctx) {
    const { keyword, categories } = ctx.req.param();
    let groups =
        categories?.split(',')?.map((category, index) => ({
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

    logger.info(JSON.stringify(groups));

    const query_josn = {
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
        View: 'changeDBAll',
        SearchFrom: 1,
    };

    const res = await got.post('https://kns.cnki.net/kns8s/brief/grid', {
        form: {
            boolSortSearch: 'true',
            QueryJson: JSON.stringify(query_josn),
            pageNum: 1,
            pageSize: 20,
            sortField: 'PT',
            sortType: 'desc',
        },
    });

    const $ = load(res.data);
    const list = $('#gridTable tbody tr')
        .map((_, data) => {
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
                guid: hashCode(title + author_name),
            };
        })
        .get();

    const items = await Promise.all(list.map((item) => cache.tryGet(item.link, () => ProcessItem(item))));

    return {
        title: `知网 - ${keyword}` + (categories ? ` - ${categories}` : ''),
        link: 'https://kns.cnki.net/kns8s/AdvSearch',
        item: items,
    };
}

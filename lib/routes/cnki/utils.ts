import { getCurrentPath } from '@/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

import got from '@/utils/got';
import { load } from 'cheerio';
import { art } from '@/utils/render';
import path from 'node:path';

const ProcessItem = async (item) => {
    const detailResponse = await got(item.link);
    const $ = load(detailResponse.data);
    item.description = art(path.join(__dirname, 'templates/desc.art'), {
        author: $('#authorpart > span')
            .map((_, item) => $(item).text().trim())
            .get()
            .join(' '),
        company: $('h3.author:not(#authorpart) > span')
            .map((_, item) => $(item).text().trim())
            .get()
            .join(' '),
        content: $('#abstract_text').attr()?.value.trim(),
    });

    return item;
};

export { ProcessItem };

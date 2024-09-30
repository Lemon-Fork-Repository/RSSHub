import { getCurrentPath } from '@/utils/helpers';
import got from '@/utils/got';
import { load } from 'cheerio';
import { art } from '@/utils/render';
import path from 'node:path';
import logger from '@/utils/logger';

const __dirname = getCurrentPath(import.meta.url);

const ProcessItem = async (item) => {
    try {
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
            content: $('#ChDivSummary').text().trim(),
        });
    } catch (error) {
        logger.error((error as Error).message);
        logger.info(`Failed to get description for ${JSON.stringify(item)}`);
    }
    return item;
};

export { ProcessItem };

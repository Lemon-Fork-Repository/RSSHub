import { getCurrentPath } from '@/utils/helpers';
import got from '@/utils/got';
import { load } from 'cheerio';
import { art } from '@/utils/render';
import path from 'node:path';
import logger from '@/utils/logger';
import crypto from 'crypto';
import { DataItem } from '@/types';
import puppeteer from '@/utils/puppeteer';
import cache from '@/utils/cache';

const __dirname = getCurrentPath(import.meta.url);

const ProcessItem = async (item: DataItem, cookie: string | null = '') => {
    try {
        const detailResponse = await got(item.link, { headers: { cookie } });
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

function generateGuid(t: string) {
    const hash = crypto.createHash('sha512');
    hash.update(t);
    return hash.digest('hex').toUpperCase();
}

async function getCookies(): Promise<string | null> {
    return (await cache.tryGet(
        'cnki:cookies',
        async () => {
            const browser = await puppeteer({ stealth: true });
            const page = await browser.newPage();

            const tmpUrl = 'https://navi.cnki.net/knavi/journals/LKGP/detail';

            await Promise.all([page.waitForSelector('.yearissuepage dt'), page.goto(tmpUrl)]);
            const cookies = await page.cookies().then((cookies) => cookies.map((c) => `${c.name}=${c.value}`).join('; '));

            await page.close();
            return cookies;
        },
        3600
    )) as any;
}

export { ProcessItem, generateGuid, getCookies };

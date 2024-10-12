import { Data, Route } from '@/types';
import cache from '@/utils/cache';
import { authFetch } from './utils';

const XIAOYUZHOU_ITEMS = 'xiaoyuzhou_items';

const isToday = (date: Date | string) => {
    date = new Date(date);
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

const ProcessFeed = async () => {
    const response = await authFetch('https://api.xiaoyuzhoufm.com/v1/editor-pick/list', { method: 'post' });

    const data = response.data;
    const playList: any[] = [];
    for (const dailyPicks of data) {
        const pubDate = new Date(dailyPicks.date + ' 00:00:00 +0800').toUTCString();
        for (const pick of dailyPicks.picks) {
            pick.pubDate = pubDate;
            playList.push(pick);
        }
    }

    return playList.map((item) => {
        const title = item.episode.title + ' - ' + item.episode.podcast.title;
        const eid = item.episode.eid;
        const itunes_item_image = item.episode.image ? item.episode.image.picUrl : item.episode.podcast.image ? item.episode.podcast.image.picUrl : '';
        const link = `https://www.xiaoyuzhoufm.com/episode/${eid}`;
        const pubDate = item.pubDate;
        const itunes_duration = item.episode.duration;
        const enclosure_url = item.episode.enclosure.url;
        const desc = `<p><strong>${item.comment.author.nickname}：</strong>${item.comment.text}</p><hr>` + item.episode.shownotes;
        const author = item.episode.podcast.author;

        return {
            title,
            description: desc,
            link,
            author,
            pubDate,
            enclosure_url,
            itunes_duration,
            itunes_item_image,
            enclosure_type: 'audio/mpeg',
        };
    });
};

export const route: Route = {
    path: '/',
    example: '/',
    radar: [
        {
            source: ['xiaoyuzhoufm.com/'],
            target: '',
        },
    ],
    name: '编辑精选',
    maintainers: ['prnake', 'Maecenas'],
    handler,
    url: 'xiaoyuzhoufm.com/',
};

async function handler() {
    let resultItems = await cache.tryGet(XIAOYUZHOU_ITEMS, () => ProcessFeed());
    if (!isToday(resultItems![0].pubDate)) {
        // force refresh cache
        resultItems = await ProcessFeed();
        cache.set(XIAOYUZHOU_ITEMS, resultItems);
    }
    return {
        title: '小宇宙 - 发现',
        link: 'https://www.xiaoyuzhoufm.com/',
        description: '小宇宙的编辑精选',
        image: 'https://www.xiaoyuzhoufm.com/apple-touch-icon.png',
        itunes_author: '小宇宙',
        itunes_category: 'Society & Culture',
        item: resultItems,
    } as Data;
}

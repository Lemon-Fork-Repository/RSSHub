// noinspection SpellCheckingInspection

import { config } from '@/config';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { FetchError, FetchOptions, ofetch } from 'ofetch';
import logger from '@/utils/logger';
import { Asset } from './types';

const REFRESH_TOKEN_KEY = 'XIAOYUZHOU_TOKEN';
const ACCESS_TOKEN_KEY = 'XIAOYUZHOU_ACCESS_TOKEN';

const COMMON_HEADERS = {
    bundleid: 'app.podcast.cosmos',
    'app-version': '2.77.1',
    'user-agent': 'Xiaoyuzhou/2.77.1 (build:2048; iOS 18.0.0)',
};

const getDeviceId = () => config.xiaoyuzhou.device_id;
const getRefreshToken = async () => (await cache.get(REFRESH_TOKEN_KEY)) || config.xiaoyuzhou.refresh_token;
const getAccessToken = async (): Promise<string | null> => {
    const access_token = await cache.get(ACCESS_TOKEN_KEY);
    if (!access_token) {
        const { access_token } = await refreshToken();
        return access_token;
    }
    return access_token;
};

export async function authFetch(api: string, options: FetchOptions = {}) {
    return await ofetch(api, {
        ...options,
        headers: {
            ...COMMON_HEADERS,
            'x-jike-access-token': (await getAccessToken())!,
            'x-jike-device-id': getDeviceId()!,
        },
    }).catch(async (error: FetchError) => {
        logger.error(JSON.stringify(options));
        logger.error(error.message);
        if (error.statusCode === 401) {
            const { access_token } = await refreshToken();
            return await ofetch(api, {
                ...options,
                headers: {
                    ...COMMON_HEADERS,
                    'x-jike-access-token': access_token,
                    'x-jike-device-id': getDeviceId()!,
                },
            });
        }
        return null as any;
    });
}

export async function refreshToken() {
    const token_updated = await got({
        method: 'post',
        url: 'https://api.xiaoyuzhoufm.com/app_auth_tokens.refresh',
        headers: {
            ...COMMON_HEADERS,
            'x-jike-device-id': getDeviceId(),
            'x-jike-refresh-token': await getRefreshToken(),
        },
    });
    const refresh_token = token_updated.data['x-jike-refresh-token'];
    const access_token = token_updated.data['x-jike-access-token'];
    cache.set(REFRESH_TOKEN_KEY, refresh_token);
    cache.set(ACCESS_TOKEN_KEY, access_token);
    return {
        refresh_token,
        access_token,
    };
}

export async function getEpisodeMedia(item: Asset): Promise<string> {
    if (item.isPrivateMedia) {
        if (item.isOwned) {
            try {
                const api = `https://api.xiaoyuzhoufm.com/v1/private-media/get?eid=${item.eid}`;
                const media: any = await cache.tryGet(api, () => authFetch(api), 14400);
                return media!.data!.url;
            } catch (error) {
                logger.error((error as Error).message);
            }
        }
        return item.trial.segment;
    }
    return item.enclosure.url;
}

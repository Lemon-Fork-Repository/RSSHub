// noinspection SpellCheckingInspection

import { config } from '@/config';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { FetchError, ofetch } from 'ofetch';
import logger from '@/utils/logger';

const REFRESH_TOKEN_KEY = 'XIAOYUZHOU_TOKEN';
const ACCESS_TOKEN_KEY = 'XIAOYUZHOU_ACCESS_TOKEN';

const COMMON_HEADERS = {
    applicationid: 'app.podcast.cosmos',
    'app-version': '2.50.1',
    'user-agent': 'okhttp/4.7.2',
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

export async function authFetch(api: string, method = 'get') {
    return await ofetch(api, {
        method,
        headers: {
            ...COMMON_HEADERS,
            'x-jike-access-token': (await getAccessToken())!,
            'x-jike-device-id': getDeviceId()!,
        },
    }).catch(async (error: FetchError) => {
        if (error.statusCode === 401) {
            logger.error(error.message);
            const { access_token } = await refreshToken();
            return await ofetch(api, {
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

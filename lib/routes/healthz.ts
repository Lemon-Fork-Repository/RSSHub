import type { Handler } from 'hono';
import { ofetch } from 'ofetch';
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '@/utils/logger';

const envs = process.env;

const handler: Handler = async (ctx) => {
    ctx.header('Cache-Control', 'no-cache');
    // this is build for sidecar restart container
    if (envs.REMOTE_CONFIG) {
        try {
            const response = await ofetch.raw(envs.REMOTE_CONFIG, {
                headers: {
                    Authorization: `Basic ${envs.REMOTE_CONFIG_AUTH}`,
                },
            });
            const content_md5 = response.headers.get('content-md5');
            const hash = await fs.readFile(path.join(process.cwd(), 'rsshub-remote-config'), { encoding: 'utf-8' });
            // - file exist
            //   - hash not exist, return 500
            //   - hash exist, compare
            // - file not exist
            //   - hash not exist, return 200
            //   - hash exist, return 500
            if (hash) {
                if (!content_md5) {
                    ctx.status(500);
                    return ctx.text('Remote config removed, please restart the service.');
                } else if (content_md5 !== hash) {
                    ctx.status(500);
                    return ctx.text('Remote config has changed, please restart the service.');
                }
            } else {
                if (content_md5) {
                    ctx.status(500);
                    return ctx.text('Remote config created, please restart the service.');
                }
            }
        } catch (error) {
            // ignore
            logger.error('health remote config check failed', { message: (error as Error).message });
        }
    }
    ctx.header('Cache-Control', 'no-cache');
    return ctx.text('ok');
};

export default handler;

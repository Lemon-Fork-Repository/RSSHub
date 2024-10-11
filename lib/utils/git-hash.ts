import { execSync } from 'child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileExist } from '@/utils/common-utils';

let gitHash = process.env.HEROKU_SLUG_COMMIT?.slice(0, 8) || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8);
let gitDate: Date | undefined;
if (!gitHash) {
    const p = path.join(process.cwd(), 'gitcommited');
    const file_exist = await fileExist(p);
    if (file_exist) {
        // git log -1 --format="%h%n%cd"  > gitcommited
        const commit_info = await fs.readFile(p, { encoding: 'utf-8' });
        const [hash, date] = commit_info.split('\n');
        gitHash = hash;
        gitDate = new Date(date);
    } else {
        try {
            gitHash = execSync('git rev-parse HEAD').toString().trim().slice(0, 8);
            gitDate = new Date(execSync('git log -1 --format=%cd').toString().trim());
        } catch {
            gitHash = 'unknown';
        }
    }
}

export { gitHash, gitDate };

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TopcoderSkill } from './topcoder';


const CACHE_DIR = path.join(os.homedir(), '.topcoder-skills');
const CACHE_FILE = path.join(CACHE_DIR, 'skills-cache.json');
const CACHE_DURATION_MS = 7 * 24 *60 * 60 * 1000; // 7 days

interface SkillsCache {
    skills: TopcoderSkill[];
    timestamp: number;
    version: string
}

function ensureCacheDir(): void {
    if(!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

export function saveSkillsCache(skills: TopcoderSkill[]): void { 

    try {

        ensureCacheDir();
        
        const cacheData: SkillsCache = {
            skills,
            timestamp: Date.now(),
            version: '1.0'
        };

        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));

    } catch (error: any) {
        console.warn('Warning: Failed to save skills cache: ', error);
    }
}

export function loadSkillsCache(): TopcoderSkill[] | null { 
    try {
        if(!fs.existsSync(CACHE_FILE)) {
            return null;
        }

        const data = fs.readFileSync(CACHE_FILE, 'utf-8');
        const cache: SkillsCache = JSON.parse(data);

        if(!cache.skills || !Array.isArray(cache.skills) || !cache.timestamp) {
            console.warn('Warning: Invalid cache format, will refresh cache');
            return null;
        }

        if(Date.now() - cache.timestamp > CACHE_DURATION_MS) {
            console.warn('Warning: Cache is expired, will refresh cache');
            return null;
        }

        return cache.skills;
    } catch (error: any) {
        console.warn('Warning: Failed to load skills cache: ', error);
        return null;
    }
}


export function clearSkillsCache(): void {
    try {
        if(fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
        }
    } catch (error: any) {
        console.warn('Warning: Failed to clear skills cache: ', error);
    }
}

export function hasValidCache(): boolean { 
    return loadSkillsCache() !== null;
}

export function getCacheInfo(): { exist: boolean; age?: string; size?: string; path: string } {
    if(!fs.existsSync(CACHE_FILE)) {
        return { exist: false, path: CACHE_FILE };
    }

    try {
        const stats = fs.statSync(CACHE_FILE);
        const data = fs.readFileSync(CACHE_FILE, 'utf-8');
        const cache: SkillsCache = JSON.parse(data);

        const age = Date.now() - cache.timestamp;
        const ageDays = Math.floor(age / (24 * 60 * 60 * 1000));
        const ageHours = Math.floor((age % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
 
        let ageStr = '';
        if(ageDays > 0) {
            ageStr += `${ageDays}d ${ageHours}h`;
        } else {
            ageStr += `${ageHours}h `;
        }

        const sizeKB = (stats.size / 1024).toFixed(2);

        return { 
            exist: true, 
            age: ageStr,
            size: `${sizeKB} KB`,
            path: CACHE_FILE
        };
    } catch (error: any) {
        console.warn('Warning: Failed to get cache info: ', error);
        return { exist: false, path: CACHE_FILE };
    }
}
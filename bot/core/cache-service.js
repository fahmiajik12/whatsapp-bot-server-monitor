const crypto = require('crypto');
const Redis = require('ioredis');
const config = require('../config.json');

let redisClient = null;
let isConnected = false;
let stats = { hits: 0, misses: 0, errors: 0, startedAt: Date.now() };

const inFlightRequests = new Map();

const redisConfig = config.redis || {};
const ENABLED = redisConfig.enabled !== false;
const HOST = redisConfig.host || 'localhost';
const PORT = redisConfig.port || 6379;
const PASSWORD = redisConfig.password || undefined;
const DB = redisConfig.db || 0;
const KEY_PREFIX = redisConfig.keyPrefix || 'wabot:';

const TTL = {
    aiChat: redisConfig.ttl?.aiChat || 600,
    aiDevops: redisConfig.ttl?.aiDevops || 300,
    aiIntent: redisConfig.ttl?.aiIntent || 1800,
    monitoring: redisConfig.ttl?.monitoring || 30,
};

function initRedis() {
    if (!ENABLED) {
        console.log('[CACHE] Redis caching dinonaktifkan di config');
        return null;
    }

    if (redisClient) return redisClient;

    try {
        redisClient = new Redis({
            host: HOST,
            port: PORT,
            password: PASSWORD || undefined,
            db: DB,
            keyPrefix: KEY_PREFIX,
            retryStrategy(times) {
                if (times > 10) {
                    console.error('[CACHE] Redis retry limit tercapai, berhenti reconnect');
                    return null;
                }
                const delay = Math.min(times * 500, 5000);
                console.log(`[CACHE] Redis reconnecting... attempt ${times} (${delay}ms)`);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
        });

        redisClient.on('connect', () => {
            isConnected = true;
            console.log(`[CACHE] ✅ Redis terhubung ke ${HOST}:${PORT} (db:${DB})`);
        });

        redisClient.on('ready', () => {
            isConnected = true;
            console.log('[CACHE] ✅ Redis siap menerima command');
        });

        redisClient.on('error', (err) => {
            if (isConnected) {
                console.error(`[CACHE] ❌ Redis error: ${err.message}`);
            }
            isConnected = false;
            stats.errors++;
        });

        redisClient.on('close', () => {
            isConnected = false;
            console.log('[CACHE] Redis koneksi terputus');
        });

        redisClient.on('reconnecting', () => {
            console.log('[CACHE] Redis reconnecting...');
        });

        return redisClient;
    } catch (err) {
        console.error(`[CACHE] Gagal inisialisasi Redis: ${err.message}`);
        return null;
    }
}

function generateKey(prefix, input) {
    const normalized = input.trim().toLowerCase().replace(/\s+/g, ' ');
    const hash = crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
    return `${prefix}:${hash}`;
}

async function getCache(key) {
    if (!ENABLED || !isConnected || !redisClient) return null;

    try {
        const value = await redisClient.get(key);
        if (value) {
            stats.hits++;
            console.log(`[CACHE] ✅ HIT — ${key}`);
            return value;
        }
        stats.misses++;
        console.log(`[CACHE] ❌ MISS — ${key}`);
        return null;
    } catch (err) {
        stats.errors++;
        console.error(`[CACHE] Error get: ${err.message}`);
        return null;
    }
}

async function setCache(key, value, ttlSeconds) {
    if (!ENABLED || !isConnected || !redisClient) return false;

    try {
        await redisClient.setex(key, ttlSeconds, value);
        console.log(`[CACHE] 💾 SET — ${key} (TTL: ${ttlSeconds}s)`);
        return true;
    } catch (err) {
        stats.errors++;
        console.error(`[CACHE] Error set: ${err.message}`);
        return false;
    }
}

async function deletePattern(pattern) {
    if (!ENABLED || !isConnected || !redisClient) return 0;

    try {
        const fullPattern = `${KEY_PREFIX}${pattern}`;
        let cursor = '0';
        let totalDeleted = 0;

        do {
            const [newCursor, keys] = await redisClient.scan(
                cursor, 'MATCH', fullPattern, 'COUNT', 100
            );
            cursor = newCursor;

            if (keys.length > 0) {
                const cleanKeys = keys.map(k => k.replace(KEY_PREFIX, ''));
                await redisClient.del(...cleanKeys);
                totalDeleted += keys.length;
            }
        } while (cursor !== '0');

        console.log(`[CACHE] 🗑️ Deleted ${totalDeleted} keys matching "${pattern}"`);
        return totalDeleted;
    } catch (err) {
        stats.errors++;
        console.error(`[CACHE] Error delete pattern: ${err.message}`);
        return 0;
    }
}

async function dedupedRequest(key, fetchFn, ttlSeconds) {
    const cached = await getCache(key);
    if (cached) return cached;

    if (inFlightRequests.has(key)) {
        console.log(`[CACHE] ⏳ DEDUP — Waiting for in-flight request: ${key}`);
        try {
            return await inFlightRequests.get(key);
        } catch (err) {
            console.log(`[CACHE] In-flight failed, creating new request`);
        }
    }
    const promise = (async () => {
        try {
            const result = await fetchFn();

            await setCache(key, result, ttlSeconds);

            return result;
        } finally {
            inFlightRequests.delete(key);
        }
    })();

    inFlightRequests.set(key, promise);
    return promise;
}

async function getStats() {
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : '0.0';
    const uptimeMs = Date.now() - stats.startedAt;
    const uptimeMin = Math.floor(uptimeMs / 60000);

    let redisInfo = {
        connected: isConnected,
        host: `${HOST}:${PORT}`,
        memoryUsage: '?',
        totalKeys: 0,
    };

    if (isConnected && redisClient) {
        try {
            const info = await redisClient.info('memory');
            const memMatch = info.match(/used_memory_human:(.+)/);
            if (memMatch) redisInfo.memoryUsage = memMatch[1].trim();

            let cursor = '0';
            let keyCount = 0;
            do {
                const [newCursor, keys] = await redisClient.scan(
                    cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 100
                );
                cursor = newCursor;
                keyCount += keys.length;
            } while (cursor !== '0');
            redisInfo.totalKeys = keyCount;
        } catch (err) {
            console.error(`[CACHE] Stats error: ${err.message}`);
        }
    }

    return {
        enabled: ENABLED,
        connected: isConnected,
        hits: stats.hits,
        misses: stats.misses,
        errors: stats.errors,
        hitRate: `${hitRate}%`,
        total: total,
        inFlight: inFlightRequests.size,
        uptimeMinutes: uptimeMin,
        redis: redisInfo,
        ttl: TTL,
    };
}

function resetStats() {
    stats = { hits: 0, misses: 0, errors: 0, startedAt: Date.now() };
    console.log('[CACHE] Stats direset');
}

async function shutdown() {
    if (redisClient) {
        console.log('[CACHE] Closing Redis connection...');
        await redisClient.quit();
        redisClient = null;
        isConnected = false;
    }
}

initRedis();

module.exports = {
    generateKey,
    getCache,
    setCache,
    deletePattern,
    dedupedRequest,
    getStats,
    resetStats,
    shutdown,
    TTL,
    isRedisConnected: () => isConnected,
};

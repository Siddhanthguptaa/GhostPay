import dotenv from 'dotenv';

dotenv.config();

let redisClient: any = null;
let useInMemoryRedis = false;

// In-memory queue/cache fallback
const memoryCache = new Map<string, { value: string; expiresAt: number }>();
const memoryQueues = new Map<string, string[]>();

export const initRedis = async (): Promise<any> => {
    try {
        const { createClient } = await import('redis');
        redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                connectTimeout: 3000,
                reconnectStrategy: (retries: number) => {
                    if (retries > 3) {
                        console.warn('⚠️  Redis reconnection failed — using in-memory fallback');
                        return new Error('Redis reconnection limit exceeded');
                    }
                    return Math.min(retries * 100, 3000);
                },
            },
        });

        redisClient.on('error', (err: any) => {
            if (!useInMemoryRedis) {
                console.warn('⚠️  Redis error, falling back to in-memory:', err.message);
                useInMemoryRedis = true;
            }
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis connected successfully');
            useInMemoryRedis = false;
        });

        await redisClient.connect();
        return redisClient;
    } catch (error: any) {
        console.warn('⚠️  Redis connection failed:', error.message);
        console.warn('⚠️  Falling back to in-memory queue/cache (demo mode)');
        useInMemoryRedis = true;
        return null;
    }
};

// Queue operations
export const queueOperations = {
    // Add item to queue
    enqueue: async (queueName: string, data: any): Promise<void> => {
        if (useInMemoryRedis) {
            if (!memoryQueues.has(queueName)) {
                memoryQueues.set(queueName, []);
            }
            memoryQueues.get(queueName)!.push(JSON.stringify(data));
            return;
        }
        try {
            await redisClient.rPush(queueName, JSON.stringify(data));
        } catch {
            if (!memoryQueues.has(queueName)) {
                memoryQueues.set(queueName, []);
            }
            memoryQueues.get(queueName)!.push(JSON.stringify(data));
        }
    },

    // Get item from queue (blocking)
    dequeue: async (queueName: string, timeout: number = 0): Promise<any> => {
        if (useInMemoryRedis) {
            const queue = memoryQueues.get(queueName);
            if (queue && queue.length > 0) {
                return JSON.parse(queue.shift()!);
            }
            return null;
        }
        try {
            const result = await redisClient.blPop(queueName, timeout);
            return result ? JSON.parse(result.element) : null;
        } catch {
            return null;
        }
    },

    // Get queue length
    length: async (queueName: string): Promise<number> => {
        if (useInMemoryRedis) {
            return memoryQueues.get(queueName)?.length || 0;
        }
        try {
            return await redisClient.lLen(queueName);
        } catch {
            return 0;
        }
    },

    // Peek at queue without removing
    peek: async (queueName: string): Promise<any> => {
        if (useInMemoryRedis) {
            const queue = memoryQueues.get(queueName);
            if (queue && queue.length > 0) {
                return JSON.parse(queue[0]);
            }
            return null;
        }
        try {
            const result = await redisClient.lIndex(queueName, 0);
            return result ? JSON.parse(result) : null;
        } catch {
            return null;
        }
    },
};

// Cache operations
export const cacheOperations = {
    // Set cache with expiry
    set: async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
        if (useInMemoryRedis) {
            memoryCache.set(key, {
                value: JSON.stringify(value),
                expiresAt: Date.now() + ttlSeconds * 1000,
            });
            return;
        }
        try {
            await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
        } catch {
            memoryCache.set(key, {
                value: JSON.stringify(value),
                expiresAt: Date.now() + ttlSeconds * 1000,
            });
        }
    },

    // Get cache
    get: async (key: string): Promise<any> => {
        if (useInMemoryRedis) {
            const entry = memoryCache.get(key);
            if (entry && entry.expiresAt > Date.now()) {
                return JSON.parse(entry.value);
            }
            memoryCache.delete(key);
            return null;
        }
        try {
            const result = await redisClient.get(key);
            return result ? JSON.parse(result) : null;
        } catch {
            return null;
        }
    },

    // Delete cache
    del: async (key: string): Promise<void> => {
        if (useInMemoryRedis) {
            memoryCache.delete(key);
            return;
        }
        try {
            await redisClient.del(key);
        } catch {
            memoryCache.delete(key);
        }
    },

    // Check if key exists
    exists: async (key: string): Promise<boolean> => {
        if (useInMemoryRedis) {
            const entry = memoryCache.get(key);
            return !!entry && entry.expiresAt > Date.now();
        }
        try {
            return (await redisClient.exists(key)) === 1;
        } catch {
            return false;
        }
    },
};

export const getRedisClient = (): any => {
    return redisClient;
};

export default redisClient;

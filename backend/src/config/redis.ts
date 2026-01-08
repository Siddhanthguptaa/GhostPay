import dotenv from 'dotenv';
import { createClient, RedisClientType } from 'redis';

dotenv.config();

let redisClient: RedisClientType;

export const initRedis = async (): Promise<RedisClientType> => {
    redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    console.error('❌ Redis reconnection failed after 10 attempts');
                    return new Error('Redis reconnection limit exceeded');
                }
                return Math.min(retries * 100, 3000);
            },
        },
    });

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('✅ Redis connected successfully');
    });

    redisClient.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
};

// Queue operations
export const queueOperations = {
    // Add item to queue
    enqueue: async (queueName: string, data: any): Promise<void> => {
        await redisClient.rPush(queueName, JSON.stringify(data));
    },

    // Get item from queue (blocking)
    dequeue: async (queueName: string, timeout: number = 0): Promise<any> => {
        const result = await redisClient.blPop(queueName, timeout);
        return result ? JSON.parse(result.element) : null;
    },

    // Get queue length
    length: async (queueName: string): Promise<number> => {
        return await redisClient.lLen(queueName);
    },

    // Peek at queue without removing
    peek: async (queueName: string): Promise<any> => {
        const result = await redisClient.lIndex(queueName, 0);
        return result ? JSON.parse(result) : null;
    },
};

// Cache operations
export const cacheOperations = {
    // Set cache with expiry
    set: async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
        await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    },

    // Get cache
    get: async (key: string): Promise<any> => {
        const result = await redisClient.get(key);
        return result ? JSON.parse(result) : null;
    },

    // Delete cache
    del: async (key: string): Promise<void> => {
        await redisClient.del(key);
    },

    // Check if key exists
    exists: async (key: string): Promise<boolean> => {
        return (await redisClient.exists(key)) === 1;
    },
};

export const getRedisClient = (): RedisClientType => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call initRedis() first.');
    }
    return redisClient;
};

export default redisClient;

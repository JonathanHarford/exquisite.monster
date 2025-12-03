import Redis from 'ioredis';
import { logger } from './logger.js';
import { REDIS_URL } from '$env/static/private';

// Enhanced Redis client configuration optimized for BullMQ
const redisUrlForLogging = REDIS_URL.replace(/:[^:@]+@/, ':***@');
logger.info('Initializing Redis connection to:', redisUrlForLogging);

// Add detailed connection diagnostics
const logConnectionDiagnostics = () => {
	try {
		const url = new URL(REDIS_URL);
		logger.info('Redis connection details:', {
			protocol: url.protocol,
			hostname: url.hostname,
			port: url.port || '6379',
			database: url.pathname.slice(1) || '0',
			hasAuth: !!url.password,
			status: redis.status
		});
	} catch {
		logger.error('Invalid REDIS_URL format:', REDIS_URL.replace(/:[^:@]+@/, ':***@'));
	}
};

export const redis = new Redis(REDIS_URL, {
	// Production-specific configurations optimized for BullMQ
	connectTimeout: 10000, // 10 seconds
	commandTimeout: 30000, // 30 seconds - increased for BullMQ operations
	lazyConnect: true,
	// Enhanced ioredis options for better connection handling
	enableReadyCheck: false,
	maxRetriesPerRequest: 3, // Allow retries for regular operations (not BullMQ workers)

	// Reconnection strategy optimized for production workloads
	reconnectOnError: (err: Error) => {
		const targetError =
			err.message.includes('READONLY') ||
			err.message.includes('EPIPE') ||
			err.message.includes('ECONNRESET') ||
			err.message.includes('ETIMEDOUT') ||
			err.message.includes('ENOTFOUND') ||
			err.message.includes('Connection is closed') ||
			err.message.includes("Stream isn't writeable");
		if (targetError) {
			logger.warn('Redis reconnecting due to error:', err.message);
			logConnectionDiagnostics();
			return true;
		}
		return false;
	},

	// Keep connection alive - important for long-running queue operations
	keepAlive: 30000,

	// Disable offline queue to prevent memory buildup during outages
	// This maintains fail-fast behavior for direct Redis operations
	enableOfflineQueue: false,

	// Connection pool settings optimized for concurrent queue operations
	family: 4, // Force IPv4 for better compatibility

	// More robust retry strategy for production
	retryStrategy: (times: number) => {
		const maxDelay = 5000; // Increased max delay to 5 seconds
		const baseDelay = 200; // Increased base delay to 200ms

		if (times > 15) {
			// Increased retry attempts
			logger.error('Redis retry limit exceeded after 15 attempts');
			logConnectionDiagnostics();
			return null; // Stop retrying after 15 attempts
		}

		const delay = Math.min(baseDelay * Math.pow(1.5, times), maxDelay);
		logger.warn(`Redis retry attempt ${times}/15, delay: ${delay}ms`);
		return delay;
	},

	// BullMQ-specific optimizations
	db: 0, // Use default database
	keyPrefix: '', // No key prefix for BullMQ compatibility

	// Enable pipeline for better throughput
	enableAutoPipelining: true,

	// Show friendly error stack in development
	showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
});

// Enhanced connection initialization with retry logic
const initializeRedis = async (retries = 3): Promise<void> => {
	logger.info('Starting Redis connection initialization...');
	logConnectionDiagnostics();

	for (let i = 0; i < retries; i++) {
		try {
			// Add a small delay before connection attempts
			if (i > 0) {
				await new Promise((resolve) => setTimeout(resolve, i * 1000));
			}

			logger.info(`Redis connection attempt ${i + 1}/${retries}...`);
			await redis.connect();
			logger.info('Redis connected successfully');

			// Test the connection with a ping
			const pingResult = await redis.ping();
			logger.info('Redis ping test successful:', pingResult);

			return;
		} catch (error) {
			const isLastAttempt = i === retries - 1;
			const err = error as Error & { code?: string; errno?: number };

			// Provide detailed error information
			const errorDetails = {
				message: err.message,
				code: err.code,
				errno: err.errno,
				attempt: i + 1,
				maxAttempts: retries,
				redisStatus: redis.status
			};

			if (isLastAttempt) {
				logger.error('Failed to connect to Redis after all retry attempts');
				logger.error('Error details:', errorDetails);

				if (err.code === 'ECONNREFUSED') {
					logger.error(
						'Connection refused - Redis server may not be running or not accepting connections'
					);
				} else if (err.code === 'ENOTFOUND') {
					logger.error('Host not found - Check Redis hostname/IP address');
				} else if (err.code === 'ETIMEDOUT') {
					logger.error('Connection timeout - Redis server may be overloaded or network issues');
				}

				// Don't throw - allow app to start without Redis
			} else {
				logger.warn(`Redis connection attempt ${i + 1} failed, retrying...`);
				logger.warn('Error details:', errorDetails);
			}
		}
	}
};

// Enhanced event handlers for better observability
redis.on('connect', () => {
	logger.info('Redis connection established');
	logConnectionDiagnostics();
});

redis.on('ready', () => {
	logger.info('Redis client ready for operations');
	logConnectionDiagnostics();
});

redis.on('error', (err) => {
	const error = err as Error & { code?: string; errno?: number };

	// Enhanced error categorization with detailed diagnostics
	const errorContext = {
		message: error.message,
		code: error.code,
		errno: error.errno,
		redisStatus: redis.status,
		timestamp: new Date().toISOString()
	};

	if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
		logger.warn('Redis connection interrupted, automatic reconnection will be attempted');
		logger.warn('Connection reset details:', errorContext);
	} else if (error.code === 'ETIMEDOUT') {
		logger.warn('Redis operation timed out - server may be overloaded');
		logger.warn('Timeout details:', errorContext);
	} else if (error.code === 'ENOTFOUND') {
		logger.error('Redis server hostname not found - check REDIS_URL configuration');
		logger.error('DNS resolution error details:', errorContext);
	} else if (error.code === 'ECONNREFUSED') {
		logger.error(
			'Redis connection refused - server may not be running or not accepting connections'
		);
		logger.error('Connection refused details:', errorContext);
		logger.error('Troubleshooting: Check if Redis is running with: redis-cli ping');
	} else if (error.message.includes('Connection is closed')) {
		logger.warn('Redis connection closed, reconnection will be attempted');
		logger.warn('Connection closure details:', errorContext);
	} else if (error.message.includes("Stream isn't writeable")) {
		logger.error('Redis stream not writeable - connection lost during operation');
		logger.error('Stream error details:', errorContext);
		logger.error('This often indicates Redis disconnected while processing commands');
	} else {
		logger.error('Unexpected Redis error occurred');
		logger.error('Error details:', errorContext);
	}

	// Always log connection diagnostics on errors
	logConnectionDiagnostics();
});

redis.on('close', () => {
	logger.warn('Redis connection closed');
	logConnectionDiagnostics();
});

redis.on('reconnecting', (ms: number) => {
	logger.info(`Redis reconnecting in ${ms}ms...`);
	logConnectionDiagnostics();
});

redis.on('end', () => {
	logger.warn('Redis connection ended permanently');
	logConnectionDiagnostics();
});

// Enhanced availability check with better error handling
export const isRedisAvailable = async (): Promise<boolean> => {
	try {
		// Check connection status first
		const status = redis.status;
		logger.debug('Redis availability check - current status:', status);

		if (!['ready', 'connecting', 'connect'].includes(status)) {
			logger.debug('Redis not available - status:', status);
			return false;
		}

		// Use a shorter timeout for availability checks
		const pingPromise = redis.ping();
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Redis ping timeout after 3s')), 3000)
		);

		const result = await Promise.race([pingPromise, timeoutPromise]);
		logger.debug('Redis ping successful:', result);
		return true;
	} catch (error) {
		const err = error as Error & { code?: string };
		const errorMessage = err.message || String(error);

		logger.debug('Redis availability check failed:', {
			error: errorMessage,
			code: err.code,
			status: redis.status
		});

		return false;
	}
};

// Enhanced Redis operations wrapper with better performance
export const safeRedisOperation = async <T>(
	operation: () => Promise<T>,
	fallback?: T,
	timeout = 5000
): Promise<T | undefined> => {
	try {
		// Quick status check before operation
		const status = redis.status;
		if (!['ready', 'connecting'].includes(status)) {
			logger.debug('Redis not ready for operation, using fallback. Status:', status);
			return fallback;
		}

		// Add timeout to prevent hanging operations
		const operationPromise = operation();
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout)
		);

		return await Promise.race([operationPromise, timeoutPromise]);
	} catch (error) {
		const err = error as Error & { code?: string };

		const errorDetails = {
			message: err.message,
			code: err.code,
			redisStatus: redis.status
		};

		if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
			logger.debug('Redis operation failed due to connection issue, using fallback:', errorDetails);
		} else if (err.message.includes('Operation timeout')) {
			logger.warn('Redis operation timed out, using fallback:', errorDetails);
		} else if (err.message.includes("Stream isn't writeable")) {
			logger.warn('Redis stream not writeable during operation, using fallback:', errorDetails);
		} else {
			logger.error('Redis operation failed:', errorDetails);
		}

		return fallback;
	}
};

// Initialize Redis connection with retry logic
initializeRedis();

// Comprehensive Redis health check and diagnostics
export const getRedisHealthReport = async (): Promise<{
	isHealthy: boolean;
	status: string;
	connectionDetails: {
		status: string;
		host?: string;
		port?: number;
		db?: number;
		connectTimeout?: number;
		commandTimeout?: number;
		enableOfflineQueue?: boolean;
		maxRetriesPerRequest?: number | null;
	};
	diagnostics: string[];
	lastError?: string;
}> => {
	const diagnostics: string[] = [];
	let lastError: string | undefined;

	try {
		// Basic connection status
		const status = redis.status;
		diagnostics.push(`Redis client status: ${status}`);

		// Connection details
		const connectionDetails = {
			status,
			host: redis.options.host,
			port: redis.options.port,
			db: redis.options.db,
			connectTimeout: redis.options.connectTimeout,
			commandTimeout: redis.options.commandTimeout,
			enableOfflineQueue: redis.options.enableOfflineQueue,
			maxRetriesPerRequest: redis.options.maxRetriesPerRequest
		};

		// Test basic connectivity
		if (['ready', 'connecting', 'connect'].includes(status)) {
			try {
				const startTime = Date.now();
				const pingResult = await Promise.race([
					redis.ping(),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('Ping timeout')), 5000)
					)
				]);
				const pingTime = Date.now() - startTime;

				diagnostics.push(`Ping successful: ${pingResult} (${pingTime}ms)`);

				// Test basic operations
				const testKey = `health_check_${Date.now()}`;
				await redis.set(testKey, 'test', 'EX', 10);
				const testValue = await redis.get(testKey);
				await redis.del(testKey);

				if (testValue === 'test') {
					diagnostics.push('Basic Redis operations (SET/GET/DEL) working correctly');
				} else {
					diagnostics.push('Warning: Basic Redis operations may have issues');
				}

				// Test Redis info
				const info = await redis.info('server');
				const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
				if (redisVersion) {
					diagnostics.push(`Redis server version: ${redisVersion}`);
				}

				return {
					isHealthy: true,
					status,
					connectionDetails,
					diagnostics
				};
			} catch (error) {
				const err = error as Error;
				lastError = err.message;
				diagnostics.push(`Connection test failed: ${err.message}`);
			}
		} else {
			diagnostics.push(`Redis not ready for operations (status: ${status})`);
		}

		// Add troubleshooting suggestions
		diagnostics.push('--- Troubleshooting Suggestions ---');
		diagnostics.push('1. Check if Redis server is running: redis-cli ping');
		diagnostics.push('2. Verify Redis server logs for errors');
		diagnostics.push('3. Check network connectivity to Redis server');
		diagnostics.push('4. Verify REDIS_URL environment variable is correct');
		diagnostics.push('5. Check if Redis server has sufficient memory');
		diagnostics.push('6. Verify firewall settings allow connections to Redis port');

		return {
			isHealthy: false,
			status,
			connectionDetails,
			diagnostics,
			lastError
		};
	} catch (error) {
		const err = error as Error;
		lastError = err.message;
		diagnostics.push(`Health check failed: ${err.message}`);

		return {
			isHealthy: false,
			status: 'unknown',
			connectionDetails: {
				status: 'unknown'
			},
			diagnostics,
			lastError
		};
	}
};

// Utility function to log comprehensive Redis diagnostics
export const logRedisHealthReport = async (): Promise<void> => {
	const report = await getRedisHealthReport();

	logger.info('=== Redis Health Report ===');
	logger.info('Health Status:', report.isHealthy ? 'HEALTHY' : 'UNHEALTHY');
	logger.info('Connection Details:', report.connectionDetails);

	for (const diagnostic of report.diagnostics) {
		logger.info(diagnostic);
	}

	if (report.lastError) {
		logger.error('Last Error:', report.lastError);
	}

	logger.info('=== End Redis Health Report ===');
};

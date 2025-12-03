/**
 * Database Operation Logging Standards
 *
 * All database operations should include consistent logging:
 *
 * CREATE operations: "Created {entity} {id} [additional context]"
 * UPDATE operations: "Updated {entity} {id} [additional context]"
 * DELETE operations: "Deleted {entity} {id} [additional context]"
 * UPSERT operations: "Upserted {entity} {id} [additional context]"
 *
 * For bulk operations, include count:
 * "Deleted {count} {entities} [additional context]"
 *
 * Examples:
 * - logger.info(`Created player ${player.id} with username: ${username}`)
 * - logger.info(`Updated season ${seasonId} status to closed`)
 * - logger.info(`Deleted favorite: ${favoritingId} -> ${favoritedId} (${count} records)`)
 * - logger.info(`Created comment ${comment.id} on game ${gameId} by player ${playerId}`)
 *
 * Use logger.error() for database operation failures with full error context.
 * Use logger.debug() for detailed operation context in development.
 */

import winston from 'winston';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

const { combine, timestamp, printf, errors } = winston.format;

// Helper function to safely stringify objects with circular references
const safeStringify = (obj: unknown, indent?: number): string => {
	const seen = new WeakSet();
	return JSON.stringify(
		obj,
		(key, value) => {
			if (typeof value === 'object' && value !== null) {
				if (seen.has(value)) {
					return '[Circular]';
				}
				seen.add(value);
			}
			return value;
		},
		indent
	);
};

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
	if (dev) {
		// For error level logs, use enhanced formatting
		if (level === 'error') {
			let formattedMessage = `\n🔍 ${timestamp} [${level.toUpperCase()}] ${message}`;

			// Add stack trace with actual line breaks if available
			if (stack) {
				formattedMessage += '\n📍 Stack Trace:\n' + stack;
			}

			// Add all metadata without filtering, using safe stringify
			if (Object.keys(meta).length > 0) {
				try {
					formattedMessage += '\n📋 Additional Info:\n' + safeStringify(meta, 2);
				} catch (error) {
					formattedMessage += '\n📋 Additional Info: [Unable to stringify metadata]';
				}
			}

			return formattedMessage;
		} else {
			// For non-error logs, use simple formatting
			let formattedMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;

			if (Object.keys(meta).length > 0) {
				try {
					formattedMessage += '\n' + safeStringify(meta, 2);
				} catch (error) {
					formattedMessage += '\n[Unable to stringify metadata]';
				}
			}

			return formattedMessage;
		}
	} else {
		// Production format (compact), using safe stringify
		let metaString = '';
		if (Object.keys(meta).length) {
			try {
				metaString = safeStringify(meta);
			} catch (error) {
				metaString = '[Unable to stringify metadata]';
			}
		}
		return `${timestamp} [${level}] ${message} ${stack || ''} ${metaString}`;
	}
});

// On Vercel/production, file logging is disabled because the filesystem is read-only.
// Only use file-based logging in development/local environments.
const transports = [];

if (env.VERCEL || !dev) {
	// Production or Vercel: log to console only
	transports.push(
		new winston.transports.Console({
			handleExceptions: true
		})
	);
} else {
	// Development: log to console and files
	transports.push(
		new winston.transports.Console({
			handleExceptions: true
		}),
		new winston.transports.File({
			filename: 'logs/application.log',
			maxsize: 5_242_880, // 5MB
			maxFiles: 5
		})
	);
}

const winstonLogger = winston.createLogger({
	level: dev ? 'debug' : 'info',
	format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
	transports,
	exceptionHandlers:
		env.VERCEL || !dev
			? [new winston.transports.Console({ handleExceptions: true })]
			: [new winston.transports.File({ filename: 'logs/exceptions.log' })]
});

// Create a fail-safe wrapper that ensures logging can NEVER crash the application
const createFailSafeLogger = (baseLogger: winston.Logger) => {
	const safeLog = (level: string, ...args: any[]) => {
		try {
			// @ts-expect-error - dynamically calling log methods
			baseLogger[level](...args);
		} catch (error) {
			// Last resort: print to console if winston fails
			try {
				console.error(`[LOGGER FAILURE] Failed to log ${level} message:`, error);
				console.error(`[LOGGER FAILURE] Original log args:`, args);
			} catch {
				// If even console.error fails, silently fail
				// Logging should never crash the app
			}
		}
	};

	return {
		error: (...args: any[]) => safeLog('error', ...args),
		warn: (...args: any[]) => safeLog('warn', ...args),
		info: (...args: any[]) => safeLog('info', ...args),
		debug: (...args: any[]) => safeLog('debug', ...args),
		verbose: (...args: any[]) => safeLog('verbose', ...args),
		silly: (...args: any[]) => safeLog('silly', ...args)
	};
};

export const logger = createFailSafeLogger(winstonLogger);

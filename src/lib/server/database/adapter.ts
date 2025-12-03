import type { PrismaClient } from '@prisma/client';

export interface DatabaseAdapter {
	/**
	 * Get the Prisma client instance
	 */
	getClient(): PrismaClient;

	/**
	 * Connect to the database
	 */
	connect(): Promise<void>;

	/**
	 * Disconnect from the database
	 */
	disconnect(): Promise<void>;

	/**
	 * Test database connectivity
	 */
	healthCheck(): Promise<boolean>;

	/**
	 * Get database connection info for debugging
	 */
	getConnectionInfo(): {
		provider: 'supabase';
		url: string;
		connected: boolean;
	};
}

export type DatabaseProvider = 'supabase';

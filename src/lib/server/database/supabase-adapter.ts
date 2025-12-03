import { env } from '$env/dynamic/private';
import { PrismaClient } from '@prisma/client';
import type { DatabaseAdapter } from './adapter.js';
import { logger } from '$lib/server/logger';

export class SupabaseAdapter implements DatabaseAdapter {
	private client: PrismaClient | null = null;
	private connected = false;

	getClient(): PrismaClient {
		if (!this.client) {
			this.client = this.createClient();
		}
		return this.client;
	}

	private createClient(): PrismaClient {
		const isTestMode = process.env.NODE_ENV === 'test';

		// For Supabase, we use different connection strings
		// Local Supabase: postgresql://postgres:postgres@127.0.0.1:54322/postgres
		// Remote Supabase: provided by Supabase dashboard
		const databaseUrl = isTestMode
			? env.SUPABASE_TEST_DATABASE_URL || this.getLocalSupabaseUrl()
			: env.SUPABASE_URL;

		return new PrismaClient({
			log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
			datasources: {
				db: {
					url: databaseUrl
				}
			}
		});
	}

	private getLocalSupabaseUrl(): string {
		// Default local Supabase connection string
		return 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
	}

	async connect(): Promise<void> {
		const client = this.getClient();
		await client.$connect();
		this.connected = true;
	}

	async disconnect(): Promise<void> {
		if (this.client) {
			await this.client.$disconnect();
			this.connected = false;
		}
	}

	async healthCheck(): Promise<boolean> {
		try {
			const client = this.getClient();
			await client.$queryRaw`SELECT 1`;
			return true;
		} catch (error) {
			logger.error('Supabase health check failed:', error);
			return false;
		}
	}

	getConnectionInfo() {
		const isTestMode = process.env.NODE_ENV === 'test';
		const url = isTestMode
			? env.SUPABASE_TEST_DATABASE_URL || this.getLocalSupabaseUrl()
			: env.SUPABASE_URL;

		return {
			provider: 'supabase' as const,
			url: url || 'Not configured',
			connected: this.connected
		};
	}
}

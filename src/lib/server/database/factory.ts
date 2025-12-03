import type { DatabaseAdapter, DatabaseProvider } from './adapter.js';
import { SupabaseAdapter } from './supabase-adapter.js';
import { logger } from '$lib/server/logger';

let _adapter: DatabaseAdapter | null = null;

/**
 * Create the Supabase database adapter
 */
function createAdapter(): DatabaseAdapter {
	logger.info('🔌 Using Supabase database adapter');
	return new SupabaseAdapter();
}

/**
 * Get the singleton database adapter instance
 */
export function getDatabaseAdapter(): DatabaseAdapter {
	if (!_adapter) {
		_adapter = createAdapter();
	}
	return _adapter;
}

/**
 * Reset the adapter instance (useful for testing)
 */
export function resetDatabaseAdapter(): void {
	if (_adapter) {
		_adapter.disconnect().catch(logger.error);
		_adapter = null;
	}
}

/**
 * Get current database provider
 */
export function getCurrentProvider(): DatabaseProvider {
	return 'supabase';
}

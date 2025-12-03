import { describe, it, expect, beforeEach } from 'vitest';
import { SupabaseAdapter } from '$lib/server/database/supabase-adapter';

describe('Database Adapter System', () => {
	describe('SupabaseAdapter', () => {
		let adapter: SupabaseAdapter;

		beforeEach(() => {
			adapter = new SupabaseAdapter();
		});

		it('should identify as supabase provider', () => {
			const connectionInfo = adapter.getConnectionInfo();
			expect(connectionInfo.provider).toBe('supabase');
		});

		it('should provide connection info', () => {
			const connectionInfo = adapter.getConnectionInfo();

			expect(connectionInfo).toMatchObject({
				provider: 'supabase',
				connected: false,
				url: expect.any(String)
			});
		});

		it('should return a Prisma client', () => {
			const client = adapter.getClient();
			expect(client).toBeDefined();
			expect(typeof client.$connect).toBe('function');
			expect(typeof client.$disconnect).toBe('function');
		});

		it('should use local supabase URL by default', () => {
			const connectionInfo = adapter.getConnectionInfo();
			expect(connectionInfo.url).toContain('127.0.0.1:54322');
		});

		it('should have all required adapter methods', () => {
			expect(typeof adapter.getClient).toBe('function');
			expect(typeof adapter.connect).toBe('function');
			expect(typeof adapter.disconnect).toBe('function');
			expect(typeof adapter.healthCheck).toBe('function');
			expect(typeof adapter.getConnectionInfo).toBe('function');
		});
	});
});

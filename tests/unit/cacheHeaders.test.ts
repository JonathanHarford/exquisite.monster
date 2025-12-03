import { describe, it, expect } from 'vitest';
import {
	buildCacheControlHeader,
	getCacheConfigForRequest,
	applyCacheHeaders,
	handleConditionalRequest,
	CACHE_CONFIGS
} from '$lib/server/cacheHeaders';
import type { RequestEvent } from '@sveltejs/kit';

// Mock RequestEvent for testing
function createMockRequestEvent(
	pathname: string,
	method: string = 'GET',
	headers: Record<string, string> = {},
	isAuthenticated: boolean = false
): RequestEvent {
	return {
		url: new URL(`http://localhost:3793${pathname}`),
		request: {
			method,
			headers: new Headers(headers)
		} as Request,
		locals: {
			auth: () => ({
				userId: isAuthenticated ? 'test-user-id' : null
			})
		}
	} as RequestEvent;
}

describe('Cache Headers', () => {
	describe('buildCacheControlHeader', () => {
		it('should build basic cache control header', () => {
			const config = {
				maxAge: 3600,
				public: true
			};

			const result = buildCacheControlHeader(config);
			expect(result).toBe('public, max-age=3600');
		});

		it('should build no-cache header', () => {
			const config = {
				maxAge: 0,
				noCache: true,
				mustRevalidate: true
			};

			const result = buildCacheControlHeader(config);
			expect(result).toBe('no-cache, max-age=0, must-revalidate');
		});

		it('should build immutable static asset header', () => {
			const config = {
				maxAge: 31536000,
				public: true,
				immutable: true
			};

			const result = buildCacheControlHeader(config);
			expect(result).toBe('public, max-age=31536000, immutable');
		});

		it('should build complex cache header with all directives', () => {
			const config = {
				maxAge: 300,
				sMaxAge: 900,
				public: true,
				staleWhileRevalidate: 1800,
				mustRevalidate: true
			};

			const result = buildCacheControlHeader(config);
			expect(result).toBe(
				'public, max-age=300, s-maxage=900, stale-while-revalidate=1800, must-revalidate'
			);
		});

		it('should handle private and no-store directives', () => {
			const config = {
				maxAge: 0,
				noCache: true,
				noStore: true,
				private: true,
				mustRevalidate: true
			};

			const result = buildCacheControlHeader(config);
			expect(result).toBe('no-cache, no-store, private, max-age=0, must-revalidate');
		});
	});

	describe('getCacheConfigForRequest', () => {
		it('should return null for non-GET requests', () => {
			const event = createMockRequestEvent('/api/games', 'POST');
			const result = getCacheConfigForRequest(event);
			expect(result).toBeNull();
		});

		it('should return static asset config for CSS files', () => {
			const event = createMockRequestEvent('/static/app.css');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.STATIC_ASSETS);
		});

		it('should return static asset config for JS files', () => {
			const event = createMockRequestEvent('/static/bundle.js');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.STATIC_ASSETS);
		});

		it('should return static asset config for image files', () => {
			const event = createMockRequestEvent('/favicon.ico');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.STATIC_ASSETS);
		});

		it('should return game data config for game API endpoints', () => {
			const event = createMockRequestEvent('/api/games/123');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.API_GAME_DATA);
		});

		it('should return static data config for config API endpoints', () => {
			const event = createMockRequestEvent('/api/config');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.API_STATIC_DATA);
		});

		it('should return no cache for other API endpoints', () => {
			const event = createMockRequestEvent('/api/auth/login');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.NO_CACHE);
		});

		it('should return semi-static config for public game pages (unauthenticated)', () => {
			const event = createMockRequestEvent('/g/game123', 'GET', {}, false);
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.HTML_SEMI_STATIC);
		});

		it('should return no cache for public game pages (authenticated)', () => {
			const event = createMockRequestEvent('/g/game123', 'GET', {}, true);
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.NO_CACHE);
		});

		it('should return semi-static config for home page', () => {
			const event = createMockRequestEvent('/');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.HTML_SEMI_STATIC);
		});

		it('should return semi-static config for gallery page', () => {
			const event = createMockRequestEvent('/g');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.HTML_SEMI_STATIC);
		});

		it('should return semi-static config for info pages', () => {
			const event = createMockRequestEvent('/info/about');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.HTML_SEMI_STATIC);
		});

		it('should return no cache for account pages', () => {
			const event = createMockRequestEvent('/account/profile');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.NO_CACHE);
		});

		it('should return no cache for admin pages', () => {
			const event = createMockRequestEvent('/admin/dashboard');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.NO_CACHE);
		});

		it('should return no cache for play pages', () => {
			const event = createMockRequestEvent('/play/turn123');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.NO_CACHE);
		});

		it('should return dynamic config for other pages', () => {
			const event = createMockRequestEvent('/some-other-page');
			const result = getCacheConfigForRequest(event);
			expect(result).toEqual(CACHE_CONFIGS.HTML_DYNAMIC);
		});
	});

	describe('applyCacheHeaders', () => {
		it('should apply cache headers to response', () => {
			const originalResponse = new Response('test content', {
				status: 200,
				headers: { 'Content-Type': 'text/html' }
			});

			const config = CACHE_CONFIGS.HTML_SEMI_STATIC;
			const result = applyCacheHeaders(originalResponse, config);

			expect(result.headers.get('Cache-Control')).toBe('public, max-age=300, must-revalidate');
			expect(result.headers.get('Vary')).toBe('Accept-Encoding');
			expect(result.headers.get('ETag')).toBeTruthy();
		});

		it('should not add ETag for no-cache responses', () => {
			const originalResponse = new Response('test content');
			const config = CACHE_CONFIGS.NO_CACHE;
			const result = applyCacheHeaders(originalResponse, config);

			expect(result.headers.get('Cache-Control')).toBe(
				'no-cache, no-store, private, max-age=0, must-revalidate'
			);
			expect(result.headers.get('ETag')).toBeNull();
		});

		it('should preserve existing headers', () => {
			const originalResponse = new Response('test content', {
				headers: {
					'Content-Type': 'application/json',
					'X-Custom-Header': 'custom-value'
				}
			});

			const config = CACHE_CONFIGS.API_GAME_DATA;
			const result = applyCacheHeaders(originalResponse, config);

			expect(result.headers.get('Content-Type')).toBe('application/json');
			expect(result.headers.get('X-Custom-Header')).toBe('custom-value');
			expect(result.headers.get('Cache-Control')).toBe(
				'public, max-age=300, s-maxage=900, stale-while-revalidate=1800'
			);
		});
	});

	describe('handleConditionalRequest', () => {
		it('should return 304 for matching ETag', () => {
			const event = createMockRequestEvent('/test', 'GET', {
				'If-None-Match': '"test-etag"'
			});

			const result = handleConditionalRequest(event, undefined, '"test-etag"');

			expect(result).toBeTruthy();
			expect(result?.status).toBe(304);
			expect(result?.headers.get('ETag')).toBe('"test-etag"');
		});

		it('should return 304 for If-None-Match: *', () => {
			const event = createMockRequestEvent('/test', 'GET', {
				'If-None-Match': '*'
			});

			const result = handleConditionalRequest(event, undefined, '"any-etag"');

			expect(result).toBeTruthy();
			expect(result?.status).toBe(304);
		});

		it('should return 304 for not modified since date', () => {
			const lastModified = new Date('2024-01-01T00:00:00Z');
			const ifModifiedSince = new Date('2024-01-01T12:00:00Z');

			const event = createMockRequestEvent('/test', 'GET', {
				'If-Modified-Since': ifModifiedSince.toUTCString()
			});

			const result = handleConditionalRequest(event, lastModified);

			expect(result).toBeTruthy();
			expect(result?.status).toBe(304);
			expect(result?.headers.get('Last-Modified')).toBe(lastModified.toUTCString());
		});

		it('should return null for non-matching ETag', () => {
			const event = createMockRequestEvent('/test', 'GET', {
				'If-None-Match': '"different-etag"'
			});

			const result = handleConditionalRequest(event, undefined, '"test-etag"');

			expect(result).toBeNull();
		});

		it('should return null for modified since date', () => {
			const lastModified = new Date('2024-01-01T12:00:00Z');
			const ifModifiedSince = new Date('2024-01-01T00:00:00Z');

			const event = createMockRequestEvent('/test', 'GET', {
				'If-Modified-Since': ifModifiedSince.toUTCString()
			});

			const result = handleConditionalRequest(event, lastModified);

			expect(result).toBeNull();
		});

		it('should return null when no conditional headers present', () => {
			const event = createMockRequestEvent('/test');
			const result = handleConditionalRequest(event);

			expect(result).toBeNull();
		});
	});
});

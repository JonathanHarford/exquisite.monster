import type { RequestEvent } from '@sveltejs/kit';

export interface CacheConfig {
	maxAge: number; // in seconds
	sMaxAge?: number; // for CDN/shared caches
	staleWhileRevalidate?: number;
	mustRevalidate?: boolean;
	noCache?: boolean;
	noStore?: boolean;
	public?: boolean;
	private?: boolean;
	immutable?: boolean;
}

/**
 * Cache configurations for different asset types
 */
export const CACHE_CONFIGS = {
	// Static assets (CSS, JS, fonts, images in /static)
	STATIC_ASSETS: {
		maxAge: 31536000, // 1 year
		public: true,
		immutable: true
	} as CacheConfig,

	// User uploaded images (profile pics, turn images)
	USER_IMAGES: {
		maxAge: 604800, // 1 week
		sMaxAge: 2592000, // 30 days for CDN
		public: true,
		staleWhileRevalidate: 86400 // 1 day
	} as CacheConfig,

	// API responses - game data
	API_GAME_DATA: {
		maxAge: 300, // 5 minutes
		sMaxAge: 900, // 15 minutes for CDN
		public: true,
		staleWhileRevalidate: 1800 // 30 minutes
	} as CacheConfig,

	// API responses - static data (configs, etc.)
	API_STATIC_DATA: {
		maxAge: 3600, // 1 hour
		sMaxAge: 86400, // 1 day for CDN
		public: true,
		staleWhileRevalidate: 7200 // 2 hours
	} as CacheConfig,

	// HTML pages - dynamic content
	HTML_DYNAMIC: {
		maxAge: 0,
		noCache: true,
		mustRevalidate: true
	} as CacheConfig,

	// HTML pages - semi-static content
	HTML_SEMI_STATIC: {
		maxAge: 300, // 5 minutes
		mustRevalidate: true,
		public: true
	} as CacheConfig,

	// Game pages - shorter cache for dynamic content like comments
	HTML_GAME_PAGES: {
		maxAge: 60, // 1 minute
		mustRevalidate: true,
		public: true,
		staleWhileRevalidate: 120 // 2 minutes
	} as CacheConfig,

	// No cache for sensitive/personalized content
	NO_CACHE: {
		maxAge: 0,
		noCache: true,
		noStore: true,
		mustRevalidate: true,
		private: true
	} as CacheConfig
} as const;

/**
 * Convert cache config to Cache-Control header value
 */
export function buildCacheControlHeader(config: CacheConfig): string {
	const directives: string[] = [];

	if (config.noCache) {
		directives.push('no-cache');
	}

	if (config.noStore) {
		directives.push('no-store');
	}

	if (config.public) {
		directives.push('public');
	} else if (config.private) {
		directives.push('private');
	}

	if (config.maxAge !== undefined) {
		directives.push(`max-age=${config.maxAge}`);
	}

	if (config.sMaxAge !== undefined) {
		directives.push(`s-maxage=${config.sMaxAge}`);
	}

	if (config.staleWhileRevalidate !== undefined) {
		directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
	}

	if (config.mustRevalidate) {
		directives.push('must-revalidate');
	}

	if (config.immutable) {
		directives.push('immutable');
	}

	return directives.join(', ');
}

/**
 * Determine appropriate cache config based on request path and type
 */
export function getCacheConfigForRequest(event: RequestEvent): CacheConfig | null {
	const { pathname } = event.url;
	const method = event.request.method;

	// Only cache GET requests
	if (method !== 'GET') {
		return null;
	}

	// Static assets from /static directory
	if (
		pathname.startsWith('/static/') ||
		pathname.match(/\.(css|js|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)$/)
	) {
		return CACHE_CONFIGS.STATIC_ASSETS;
	}

	// API routes
	if (pathname.startsWith('/api/')) {
		// Game-related API endpoints
		if (pathname.includes('/games') || pathname.includes('/turns')) {
			return CACHE_CONFIGS.API_GAME_DATA;
		}

		// Configuration or other static API data
		if (pathname.includes('/config') || pathname.includes('/static')) {
			return CACHE_CONFIGS.API_STATIC_DATA;
		}

		// Default for other API endpoints - no cache for safety
		return CACHE_CONFIGS.NO_CACHE;
	}

	// Public game pages - only cache for unauthenticated users
	// Authenticated users can add comments and should see real-time updates
	if (pathname.startsWith('/g/') && !pathname.includes('/admin/')) {
		const isAuthenticated = event.locals.auth?.()?.userId;
		return isAuthenticated ? CACHE_CONFIGS.NO_CACHE : CACHE_CONFIGS.HTML_SEMI_STATIC;
	}

	// Public gallery page
	if (pathname === '/g' || pathname === '/') {
		return CACHE_CONFIGS.HTML_SEMI_STATIC;
	}

	// Info pages (about, terms, etc.)
	if (pathname.startsWith('/info/')) {
		return CACHE_CONFIGS.HTML_SEMI_STATIC;
	}

	// User-specific or admin pages - no cache
	if (
		pathname.startsWith('/account') ||
		pathname.startsWith('/admin') ||
		pathname.startsWith('/play')
	) {
		return CACHE_CONFIGS.NO_CACHE;
	}

	// Default for other pages - short cache
	return CACHE_CONFIGS.HTML_DYNAMIC;
}

/**
 * Generate a content-aware ETag based on various factors
 * This helps with cache invalidation when content actually changes
 */
export function generateContentETag(
	baseContent: string,
	lastModified?: Date,
	additionalFactors?: Array<string | number | Date>
): string {
	const factors = [
		baseContent,
		lastModified?.toISOString() || new Date().toISOString(),
		...(additionalFactors || [])
	];

	const combined = factors.join('|');
	return `"${Buffer.from(combined).toString('base64')}"`;
}

/**
 * Apply cache headers to a response
 */
export function applyCacheHeaders(
	response: Response,
	config: CacheConfig,
	event?: RequestEvent
): Response {
	const headers = new Headers(response.headers);

	// Set Cache-Control header
	const cacheControl = buildCacheControlHeader(config);
	headers.set('Cache-Control', cacheControl);

	// Add ETag for conditional requests (if not already present)
	if (!headers.has('ETag') && !config.noCache && !config.noStore) {
		// Generate simple ETag based on content length and last modified
		const contentLength = headers.get('Content-Length') || '0';
		const lastModified = headers.get('Last-Modified') || new Date().toISOString();
		const etag = `"${Buffer.from(contentLength + lastModified).toString('base64')}"`;
		headers.set('ETag', etag);
	}

	// Add Vary header for content negotiation
	if (!headers.has('Vary')) {
		headers.set('Vary', 'Accept-Encoding');
	}

	// Log cache configuration in development
	if (event && process.env.NODE_ENV === 'development') {
		// logger.debug(`Cache headers applied to ${event.url.pathname}: ${cacheControl}`);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

/**
 * Check if request has conditional headers and respond with 304 if appropriate
 */
export function handleConditionalRequest(
	event: RequestEvent,
	lastModified?: Date,
	etag?: string
): Response | null {
	const ifModifiedSince = event.request.headers.get('If-Modified-Since');
	const ifNoneMatch = event.request.headers.get('If-None-Match');

	// Check ETag first
	if (ifNoneMatch && etag) {
		if (ifNoneMatch === etag || ifNoneMatch === '*') {
			return new Response(null, {
				status: 304,
				headers: {
					ETag: etag,
					'Cache-Control': buildCacheControlHeader(
						getCacheConfigForRequest(event) || CACHE_CONFIGS.NO_CACHE
					)
				}
			});
		}
	}

	// Check Last-Modified
	if (ifModifiedSince && lastModified) {
		const ifModifiedSinceDate = new Date(ifModifiedSince);
		if (lastModified <= ifModifiedSinceDate) {
			return new Response(null, {
				status: 304,
				headers: {
					'Last-Modified': lastModified.toUTCString(),
					'Cache-Control': buildCacheControlHeader(
						getCacheConfigForRequest(event) || CACHE_CONFIGS.NO_CACHE
					)
				}
			});
		}
	}

	return null;
}

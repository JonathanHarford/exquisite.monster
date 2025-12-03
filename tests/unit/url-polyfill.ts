// URL polyfill that must be loaded before any SvelteKit modules
// Force immediate availability by setting it synchronously
class URLPolyfill {
	href: string;
	origin: string;
	protocol: string;
	host: string;
	hostname: string;
	port: string;
	pathname: string;
	search: string;
	searchParams: URLSearchParams;
	hash: string;
	username: string = '';
	password: string = '';

	constructor(url: string | URL, base?: string) {
		let fullUrl = url.toString();
		if (base) {
			// Simple URL resolution for test purposes
			const baseMatch = base.match(/^(https?:)\/\/([^\/]+)/);
			if (baseMatch) {
				fullUrl = `${baseMatch[1]}//${baseMatch[2]}${fullUrl.startsWith('/') ? fullUrl : '/' + fullUrl}`;
			}
		}

		// Handle special SvelteKit internal URLs
		if (fullUrl.startsWith('sveltekit-internal://')) {
			this.protocol = 'sveltekit-internal:';
			this.host = '';
			this.hostname = '';
			this.port = '';
			this.pathname = '/';
			this.search = '';
			this.hash = '';
			this.origin = 'sveltekit-internal://';
			this.searchParams = new URLSearchParams();
			this.href = fullUrl;
			return;
		}

		const match = fullUrl.match(/^([a-z][a-z\d+\-.]*:)\/\/([^\/]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
		if (!match) {
			// Basic error for invalid URLs to mimic native behavior
			try {
				const native = new (require('url').URL)(url, base);
				this.href = native.href;
				this.protocol = native.protocol;
				this.host = native.host;
				this.hostname = native.hostname;
				this.port = native.port;
				this.pathname = native.pathname;
				this.search = native.search;
				this.hash = native.hash;
				this.origin = native.origin;
				this.searchParams = new URLSearchParams(native.searchParams.toString());
			} catch {
				throw new Error('Invalid URL: ' + fullUrl);
			}
			return;
		}

		this.protocol = match[1];
		this.host = match[2];
		this.hostname = match[2].split(':')[0];
		this.port = match[2].split(':')[1] || '';
		this.pathname = match[3] || '/';
		this.search = match[4] || '';
		this.hash = match[5] || '';
		this.origin = `${this.protocol}//${this.host}`;
		this.searchParams = new URLSearchParams(this.search);
		this.href = fullUrl;
	}

	toString() {
		const searchString = this.searchParams.toString();
		const query = searchString ? `?${searchString}` : '';
		return `${this.protocol}//${this.host}${this.pathname}${query}${this.hash}`;
	}

	toJSON() {
		return this.toString();
	}

	static canParse(url: string, base?: string) {
		try {
			new URLPolyfill(url, base);
			return true;
		} catch {
			return false;
		}
	}

	static createObjectURL() {
		return 'blob:mock-url';
	}

	static parse(url: string, base?: string) {
		try {
			return new URLPolyfill(url, base);
		} catch {
			return null;
		}
	}

	static revokeObjectURL() {
		// Mock implementation
	}
}

// Set the URL polyfill immediately and unconditionally
globalThis.URL = URLPolyfill as any;

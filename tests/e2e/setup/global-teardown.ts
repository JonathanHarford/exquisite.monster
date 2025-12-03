import { BrowserManager } from '../helpers/browser-manager';

async function globalTeardown() {
	console.log('🧹 Cleaning up browser contexts...');
	await BrowserManager.cleanup();
	console.log('🧹 Global test teardown complete');
}

export default globalTeardown;

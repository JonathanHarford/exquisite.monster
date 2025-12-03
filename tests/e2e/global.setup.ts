import { test as setup } from '@playwright/test';

// This file handles database setup for the test suite
// The global database reset and seeding is now handled by global-test-setup.ts
// This file focuses only on the database reset needed for the db-setup project

setup('setup test database', async () => {
	console.log('🔄 Database setup for test run completed by global setup');
	// All database initialization is now handled by the global setup script
	// This test just ensures the db-setup project dependency is satisfied
});

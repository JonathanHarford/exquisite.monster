import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseState(): Promise<boolean> {
	try {
		// Check if essential data exists
		const [playerCount, configCount] = await Promise.all([
			prisma.player.count(),
			prisma.gameConfig.count()
		]);

		return playerCount >= 3 && configCount > 0;
	} catch {
		return false;
	}
}

async function globalSetup() {
	console.log('🔄 Checking test database state...');

	try {
		// Check if database is already properly seeded
		const isSeeded = await checkDatabaseState();

		if (!isSeeded) {
			console.log('🔄 Setting up test database...');
			// Run the test setup script to reset and seed the database
			execSync('npm run test:setup', {
				stdio: 'inherit',
				env: { ...process.env, NODE_ENV: 'test' }
			});
		} else {
			console.log('✅ Test database already seeded, skipping setup');
		}

		// Verify setup was successful
		const finalCheck = await checkDatabaseState();
		if (!finalCheck) {
			throw new Error('Database setup verification failed');
		}

		console.log('✅ Test database ready');
	} catch (error) {
		console.error('❌ Failed to setup test database:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

export default globalSetup;

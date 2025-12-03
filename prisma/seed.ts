import { PrismaClient } from '@prisma/client';
import { seedPlayers, getPlayerById } from './seed/seedPlayers.js';
import { seedCopyText } from './seed/seedCopyText.js';
import { seedGames } from './seed/seedGames.js';
import { seedDefaultConfig } from './seed/seedConfig.js';

let prisma: PrismaClient | null = null;

async function main() {
	console.log('🌱 Starting database seeding...');
	console.log('📍 Database:', process.env.DATABASE_URL?.substring(0, 50) + '...');

	// Validate required environment variables
	const requiredEnvVars = ['DATABASE_URL', 'CLERK_SECRET_KEY', 'ADMIN_EMAIL', 'PUBLIC_SITE_TITLE'];
	prisma = new PrismaClient();
	const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
	if (missingVars.length > 0) {
		throw new Error(
			`❌ Missing required environment variables: ${missingVars.join(', ')}\n` +
				'Please ensure these are set in your environment'
		);
	}

	try {
		console.log('🌱 Starting database seeding...');

		const testPlayers = await seedPlayers(prisma);
		const playerLookup = (playerId: string) => getPlayerById(testPlayers, playerId);

		await seedCopyText(prisma);
		const config = await seedDefaultConfig(prisma);

		await seedGames(prisma, config, playerLookup);

		console.log('🎉 Database seeding completed successfully!');
	} catch (error) {
		console.error('❌ Database seeding failed:', error);
		process.exit(1);
	}
}

main()
	.then(async () => {
		if (prisma) {
			await prisma.$disconnect();
		}
	})
	.catch(async (e) => {
		console.error('❌ Seeding failed:', e);
		if (prisma) {
			await prisma.$disconnect();
		}
		process.exit(1);
	});

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllGames() {
	console.log('🗑️  Clearing all games...');

	try {
		// Delete in order due to foreign key constraints
		await prisma.turn.deleteMany({});
		console.log('   Deleted all turns');

		await prisma.gameConfig.deleteMany({
			where: {
				id: { not: 'default' } // Keep the default config
			}
		});
		console.log('   Deleted all game configs (except default)');

		await prisma.game.deleteMany({});
		console.log('   Deleted all games');

		console.log('✅ All games cleared successfully!');
	} catch (error) {
		console.error('❌ Error clearing games:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

// Run the function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	clearAllGames().catch((error) => {
		console.error('Script failed:', error);
		process.exit(1);
	});
}

export { clearAllGames };

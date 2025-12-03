import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

function createE2EPrismaClient(): PrismaClient {
	return new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
	});
}

// Create a Prisma client for e2e tests that doesn't depend on SvelteKit's $env
const prisma = createE2EPrismaClient();

export { prisma };

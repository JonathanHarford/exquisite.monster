// scripts/setup-storage.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createStorageBucket() {
	const { error } = await supabase.storage.createBucket('epyc-storage', {
		public: true,
		allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
		fileSizeLimit: '10MB'
	});

	if (error && !error.message.includes('already exists')) {
		console.error('Error creating bucket:', error);
		process.exit(1);
	}

	console.log('✅ Storage bucket created/verified');
}

createStorageBucket();

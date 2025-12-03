import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

interface CopyTextData {
	key: string;
	lang: string;
	value: string;
}

interface CopyTextYaml {
	copytext: CopyTextData[];
}

const parseCopyTextYAML = (yamlPath: string): CopyTextData[] => {
	const yamlContent = readFileSync(yamlPath, 'utf-8');
	const data = yaml.load(yamlContent) as CopyTextYaml;

	return data.copytext.map((item) => ({
		...item,
		value: item.value.replace(
			/\${process\.env\.PUBLIC_SITE_TITLE}/g,
			process.env.PUBLIC_SITE_TITLE || 'EPYC'
		)
	}));
};

export const seedCopyText = async (prisma: PrismaClient) => {
	console.log('📘 Seeding copy text...');

	// Load copy text from YAML
	const yamlPath = join(process.cwd(), 'prisma/seed/data/copytext.yaml');
	const copyTexts = parseCopyTextYAML(yamlPath);

	for (const copyTextData of copyTexts) {
		await prisma.copyText.upsert({
			where: { key_lang: { key: copyTextData.key, lang: copyTextData.lang } },
			update: { value: copyTextData.value },
			create: {
				key: copyTextData.key,
				lang: copyTextData.lang,
				value: copyTextData.value
			}
		});
		console.log(`Upserted CopyText: ${copyTextData.key} [${copyTextData.lang}]`);
	}

	console.log('✅ CopyText entries seeded successfully');
};

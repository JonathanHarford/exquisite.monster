import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

interface DefaultConfigYaml {
	defaultConfig: {
		minTurns: number;
		maxTurns: number | null;
		writingTimeout: string;
		drawingTimeout: string;
		gameTimeout: string;
	};
}

const parseDefaultConfigYAML = (yamlPath: string): DefaultConfigYaml['defaultConfig'] => {
	const yamlContent = readFileSync(yamlPath, 'utf-8');
	const data = yaml.load(yamlContent) as DefaultConfigYaml;

	return data.defaultConfig;
};

// Export function to load default config from YAML
export const loadDefaultConfig = (): DefaultConfigYaml['defaultConfig'] => {
	const defaultConfigPath = join(process.cwd(), 'prisma/seed/data/defaultConfig.yaml');
	return parseDefaultConfigYAML(defaultConfigPath);
};

export const seedDefaultConfig = async (prisma: PrismaClient) => {
	// Ensure default game config exists
	let config = await prisma.gameConfig.findUnique({
		where: { id: 'default' }
	});

	if (config) {
		console.log('Default game config already exists');
	} else {
		// Load default config from YAML
		const defaultConfigData = loadDefaultConfig();
		config = await prisma.gameConfig.create({
			data: {
				id: 'default',
				minTurns: defaultConfigData.minTurns,
				maxTurns: defaultConfigData.maxTurns,
				writingTimeout: defaultConfigData.writingTimeout,
				drawingTimeout: defaultConfigData.drawingTimeout,
				gameTimeout: defaultConfigData.gameTimeout,
				isLewd: false
			}
		});
		console.log('✅ Created default game config:', { config });
	}
	return config;
};

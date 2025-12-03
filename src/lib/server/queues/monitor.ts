import { logger } from '$lib/server/logger.js';
import type { QueueManager } from './config.js';

export interface QueueStats {
	waiting: number;
	active: number;
	completed: number;
	failed: number;
}

export interface QueueHealth {
	isHealthy: boolean;
	queueStats?: QueueStats;
	error?: string;
}

// Queue registry for monitoring
const queueRegistry = new Map<string, QueueManager>();

export class QueueMonitor {
	private static instance: QueueMonitor;
	private monitoringInterval: NodeJS.Timeout | null = null;

	static getInstance(): QueueMonitor {
		if (!QueueMonitor.instance) {
			QueueMonitor.instance = new QueueMonitor();
		}
		return QueueMonitor.instance;
	}

	// Register a queue manager for monitoring
	registerQueue(name: string, queueManager: QueueManager): void {
		queueRegistry.set(name, queueManager);
		logger.debug(`Registered queue for monitoring: ${name}`);
	}

	// Unregister a queue manager
	unregisterQueue(name: string): void {
		queueRegistry.delete(name);
		logger.debug(`Unregistered queue from monitoring: ${name}`);
	}

	// Start monitoring all registered queues
	startMonitoring(intervalMs = 60000): void {
		if (this.monitoringInterval) {
			logger.warn('Queue monitoring is already running');
			return;
		}

		this.monitoringInterval = setInterval(async () => {
			await this.checkQueueHealth();
		}, intervalMs);

		logger.info(`Queue monitoring started with ${intervalMs}ms interval`);
	}

	// Stop monitoring
	stopMonitoring(): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
			logger.info('Queue monitoring stopped');
		}
	}

	// Check health of all registered queues
	async checkQueueHealth(): Promise<Map<string, QueueHealth>> {
		const healthResults = new Map<string, QueueHealth>();

		for (const [queueName, queueManager] of queueRegistry) {
			try {
				const health = await queueManager.getHealthStatus();
				healthResults.set(queueName, health);

				// Log warnings for unhealthy queues or high job counts
				if (!health.isHealthy) {
					logger.warn(`Queue ${queueName} is unhealthy`);
				} else if (health.queueStats) {
					const { waiting, failed } = health.queueStats;
					if (waiting > 100) {
						logger.warn(`Queue ${queueName} has high waiting jobs: ${waiting}`);
					}
					if (failed > 10) {
						logger.warn(`Queue ${queueName} has high failed jobs: ${failed}`);
					}
				}
			} catch (error) {
				logger.error(`Failed to check health for queue ${queueName}:`, error);
				healthResults.set(queueName, {
					isHealthy: false,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		return healthResults;
	}

	// Get overall system health
	async getSystemHealth(): Promise<{
		overallHealthy: boolean;
		queues: Record<string, QueueHealth>;
		summary: {
			total: number;
			healthy: number;
			unhealthy: number;
		};
	}> {
		const healthResults = await this.checkQueueHealth();
		const queues: Record<string, QueueHealth> = {};
		let healthyCount = 0;

		for (const [queueName, health] of healthResults) {
			queues[queueName] = health;
			if (health.isHealthy) {
				healthyCount++;
			}
		}

		return {
			overallHealthy: healthyCount === healthResults.size,
			queues,
			summary: {
				total: healthResults.size,
				healthy: healthyCount,
				unhealthy: healthResults.size - healthyCount
			}
		};
	}

	// Gracefully shutdown all registered queues
	async shutdownAllQueues(): Promise<void> {
		logger.info('Shutting down all queues...');

		const shutdownPromises = Array.from(queueRegistry.entries()).map(
			async ([queueName, queueManager]) => {
				try {
					await queueManager.close();
					logger.info(`Queue ${queueName} shut down successfully`);
				} catch (error) {
					logger.error(`Failed to shut down queue ${queueName}:`, error);
				}
			}
		);

		await Promise.all(shutdownPromises);
		queueRegistry.clear();
		this.stopMonitoring();
		logger.info('All queues shut down');
	}
}

// Export singleton instance
export const queueMonitor = QueueMonitor.getInstance();

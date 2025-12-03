import { redis } from '$lib/server/redis';
import { logger } from '$lib/server/logger';

class SSEService {
	private subscriber: typeof redis;
	private clients: Map<string, Set<ReadableStreamDefaultController>>;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private ready: Promise<void>;

	constructor() {
		this.subscriber = redis.duplicate();
		this.clients = new Map();

		this.ready = this.setupSubscriber();
		this.startHeartbeat();
	}

	private async setupSubscriber(): Promise<void> {
		this.subscriber.on('message', (channel, message) => {
			this.handleMessage(channel, message);
		});

		this.subscriber.on('error', (err) => {
			logger.error('SSE Redis subscriber error:', err);
		});

		try {
			await this.subscriber.connect();
			logger.info('SSE Service: Redis subscriber connected');
		} catch (err) {
			logger.error('SSE Service: Failed to connect Redis subscriber', err);
			throw err;
		}
	}

	private handleMessage(channel: string, message: string) {
		if (!channel.startsWith('notification:')) return;
		const userId = channel.replace('notification:', '');

		const userClients = this.clients.get(userId);
		if (userClients) {
			try {
				const data = `event: notification\ndata: ${message}\n\n`;
				const encoder = new TextEncoder();
				const encoded = encoder.encode(data);

				const deadControllers: ReadableStreamDefaultController[] = [];

				for (const controller of userClients) {
					try {
						controller.enqueue(encoded);
					} catch (err) {
						// Controller is closed, mark for removal
						logger.debug(`Failed to send notification to user ${userId} (connection closed), removing dead controller`);
						deadControllers.push(controller);
					}
				}

				// Clean up dead controllers
				for (const controller of deadControllers) {
					userClients.delete(controller);
				}

				// If all clients are gone, clean up the user's subscription
				if (userClients.size === 0) {
					this.clients.delete(userId);
					this.subscriber.unsubscribe(`notification:${userId}`).catch(err => {
						logger.error(`Failed to unsubscribe from notification:${userId}`, err);
					});
					logger.debug(`All clients disconnected for user ${userId}, unsubscribed`);
				}
			} catch (err) {
				logger.error('Error processing SSE message:', err);
			}
		}
	}

	public async addClient(userId: string, controller: ReadableStreamDefaultController) {
		// Wait for Redis subscriber to be ready
		await this.ready;

		if (!this.clients.has(userId)) {
			this.clients.set(userId, new Set());
			try {
				await this.subscriber.subscribe(`notification:${userId}`);
				logger.debug(`Subscribed to notification:${userId}`);
			} catch (err) {
				logger.error(`Failed to subscribe to notification:${userId}`, err);
				throw err;
			}
		}
		this.clients.get(userId)?.add(controller);
		logger.debug(`SSE Client added for user ${userId}. Total clients: ${this.clients.get(userId)?.size}`);
	}

	public async removeClient(userId: string, controller: ReadableStreamDefaultController) {
		const userClients = this.clients.get(userId);
		if (userClients) {
			userClients.delete(controller);
			logger.debug(`SSE Client removed for user ${userId}. Remaining clients: ${userClients.size}`);

			if (userClients.size === 0) {
				this.clients.delete(userId);
				try {
					await this.subscriber.unsubscribe(`notification:${userId}`);
					logger.debug(`Unsubscribed from notification:${userId}`);
				} catch (err) {
					logger.error(`Failed to unsubscribe from notification:${userId}`, err);
				}
			}
		}
	}

	private startHeartbeat() {
		if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

		this.heartbeatInterval = setInterval(() => {
			const heartbeat = `: heartbeat\n\n`;
			const encoder = new TextEncoder();
			const encoded = encoder.encode(heartbeat);

			for (const [userId, userClients] of this.clients.entries()) {
				const deadControllers: ReadableStreamDefaultController[] = [];

				for (const controller of userClients) {
					try {
						controller.enqueue(encoded);
					} catch (err) {
						// Controller is closed, mark for removal
						logger.debug(`Heartbeat failed for user ${userId}, removing dead controller`);
						deadControllers.push(controller);
					}
				}

				// Clean up dead controllers
				for (const controller of deadControllers) {
					userClients.delete(controller);
				}

				// If all clients are gone, clean up the user's subscription
				if (userClients.size === 0) {
					this.clients.delete(userId);
					this.subscriber.unsubscribe(`notification:${userId}`).catch(err => {
						logger.error(`Failed to unsubscribe from notification:${userId}`, err);
					});
					logger.debug(`All clients disconnected for user ${userId} during heartbeat, unsubscribed`);
				}
			}
		}, 30000);
	}

	public shutdown() {
		if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
		this.subscriber.quit();
	}
}

export const sseService = new SSEService();

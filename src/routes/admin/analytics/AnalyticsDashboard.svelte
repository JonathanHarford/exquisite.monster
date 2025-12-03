<script lang="ts">
	import { onMount } from 'svelte';
	import { Badge, Spinner, Alert } from 'flowbite-svelte';

	interface GameAnalytics {
		overview: {
			activeGames: number;
			completedGames: number;
			gamesWithFlags: number;
			avgCompletionTimeHours: number;
			avgTurnsPerGame: number;
		};
	}

	interface FlagAnalytics {
		overview: {
			totalFlags: number;
			resolvedFlags: number;
			pendingFlags: number;
			resolutionRate: number;
		};
		byReason: Array<{
			reason: string;
			count: number;
		}>;
	}

	interface AnalyticsData {
		site: {
			overview: {
				totalPlayers: number;
				totalGames: number;
				totalTurns: number;
				totalFlags: number;
				completedGames: number;
				activeGames: number;
				resolvedFlags: number;
				pendingFlags: number;
			};
			activity: {
				activePlayers7d: number;
				activePlayers30d: number;
				newPlayers7d: number;
				newPlayers30d: number;
				newGames7d: number;
				newGames30d: number;
				[key: string]: number;
			};
		};
		players: {
			topByTurns: Array<{
				id: string;
				username: string;
				imageUrl: string;
				_count: {
					turns: number;
					turnFlags: number;
				};
			}>;
			mostActive: Array<{
				id:string;
				username: string;
				imageUrl: string;
				_count: {
					turns: number;
				};
			}>;
		};
		daily: {
			players: Array<{ date: string; count: number }>;
			games: Array<{ date: string; count: number }>;
			turns: Array<{ date: string; count: number }>;
			flags: Array<{ date: string; count: number }>;
		};
		games: GameAnalytics;
		flags: FlagAnalytics;
		generatedAt: string;
	}

	let analyticsData = $state<AnalyticsData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedTimeframe = $state('30');

	const fetchAnalytics = async (days: string = '30') => {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/analytics?type=all&days=${days}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch analytics: ${response.statusText}`);
			}
			analyticsData = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load analytics';
			console.error('Analytics fetch error:', err);
		} finally {
			loading = false;
		}
	};

	const handleTimeframeChange = (days: string) => {
		selectedTimeframe = days;
		fetchAnalytics(days);
	};

	onMount(() => {
		fetchAnalytics(selectedTimeframe);
	});

	const formatNumber = (num: number) => {
		return new Intl.NumberFormat().format(num);
	};

	const formatPercentage = (num: number) => {
		return `${num.toFixed(1)}%`;
	};
</script>

<div class="analytics-dashboard space-y-6">
	{#if loading}
		<div class="flex items-center justify-center">
			<div class="text-center">
				<Spinner size="10" />
				<p>Loading analytics...</p>
				<p>Gathering platform insights</p>
			</div>
		</div>
	{:else if error}
		<Alert color="red">
			<div class="flex items-center">
				<iconify-icon icon="material-symbols:error" class="h-6 w-6"></iconify-icon>
				<div class="flex-1">
					<h4>Analytics Error</h4>
					<p>{error}</p>
				</div>
				<button
					type="button"
					class="btn btn-danger"
					onclick={() => fetchAnalytics(selectedTimeframe)}
				>
					<iconify-icon icon="material-symbols:refresh" class="h-4 w-4"></iconify-icon>
					Retry
				</button>
			</div>
		</Alert>
	{:else if analyticsData}
		<!-- Header with Timeframe Selector -->
		<div class="flex items-center justify-between">
			<div>
				<h3>Platform Overview</h3>
				<p>Real-time performance metrics and insights</p>
			</div>
			<div class="flex gap-2 rounded-lg">
				<button
					type="button"
					class={selectedTimeframe === '7' ? 'btn btn-primary' : 'btn btn-primary'}
					onclick={() => handleTimeframeChange('7')}
				>
					7 Days
				</button>
				<button
					type="button"
					class={selectedTimeframe === '30' ? 'btn btn-primary' : 'btn btn-primary'}
					onclick={() => handleTimeframeChange('30')}
				>
					30 Days
				</button>
				<button
					type="button"
					class={selectedTimeframe === '90' ? 'btn btn-primary' : 'btn btn-primary'}
					onclick={() => handleTimeframeChange('90')}
				>
					90 Days
				</button>
			</div>
		</div>

		<!-- Overview Cards -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<!-- Total Players -->
			<div class="rounded-xl border border-solid border-black">
				<div class="flex items-center justify-between">
					<div class="flex-1">
						<p>Total Players</p>
						<p>{formatNumber(analyticsData.site.overview.totalPlayers)}</p>
						<div class="flex items-center">
							<iconify-icon icon="material-symbols:trending-up" class="h-4 w-4"></iconify-icon>
							<span
								>+{formatNumber(
									analyticsData.site.activity[`newPlayers${selectedTimeframe}d`]
								)}</span
							>
							<span>this period</span>
						</div>
					</div>
					<div class="rounded-full">
						<iconify-icon icon="material-symbols:person" class="h-8 w-8"></iconify-icon>
					</div>
				</div>
			</div>

			<!-- Total Games -->
			<div class="rounded-xl border border-solid border-black">
				<div class="flex items-center justify-between">
					<div class="flex-1">
						<p>Total Games</p>
						<p>{formatNumber(analyticsData.site.overview.totalGames)}</p>
						<div class="flex items-center">
							<iconify-icon icon="material-symbols:trending-up" class="h-4 w-4"></iconify-icon>
							<span
								>+{formatNumber(analyticsData.site.activity[`newGames${selectedTimeframe}d`])}</span
							>
							<span>this period</span>
						</div>
					</div>
					<div class="rounded-full">
						<iconify-icon icon="material-symbols:gamepad" class="h-8 w-8"></iconify-icon>
					</div>
				</div>
			</div>

			<!-- Active Players -->
			<div class="rounded-xl border border-solid border-black">
				<div class="flex items-center justify-between">
					<div class="flex-1">
						<p>Active Players</p>
						<p>{formatNumber(analyticsData.site.activity[`activePlayers${selectedTimeframe}d`])}</p>
						<div class="flex items-center">
							<iconify-icon icon="material-symbols:schedule" class="h-4 w-4"></iconify-icon>
							<span>Last {selectedTimeframe} days</span>
						</div>
					</div>
					<div class="rounded-full">
						<iconify-icon icon="material-symbols:trending-up" class="h-8 w-8"></iconify-icon>
					</div>
				</div>
			</div>

			<!-- Flags Status -->
			<div class="rounded-xl border border-solid border-black">
				<div class="flex items-center justify-between">
					<div class="flex-1">
						<p>Total Flags</p>
						<p>{formatNumber(analyticsData.site.overview.totalFlags)}</p>
						<div class="flex items-center">
							<iconify-icon icon="material-symbols:pending" class="h-4 w-4"></iconify-icon>
							<span>{formatNumber(analyticsData.site.overview.pendingFlags)}</span>
							<span>pending</span>
						</div>
					</div>
					<div class="rounded-full">
						<iconify-icon icon="material-symbols:flag" class="h-8 w-8"></iconify-icon>
					</div>
				</div>
			</div>
		</div>

		<!-- Detailed Analytics Grid -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Game Status -->
			<div class="overflow-hidden rounded-xl border border-solid border-black shadow-sm">
				<div class="border-b border-solid border-black">
					<h4 class="flex items-center gap-2">
						<iconify-icon icon="material-symbols:gamepad" class="h-5 w-5"></iconify-icon>
						Game Analytics
					</h4>
				</div>
				<div class="space-y-4">
					<div class="flex items-center justify-between border-b border-solid border-black">
						<div class="flex items-center gap-3">
							<div class="h-3 w-3 rounded-full"></div>
							<span>Completed Games</span>
						</div>
						<span>{formatNumber(analyticsData.site.overview.completedGames)}</span>
					</div>
					<div class="flex items-center justify-between border-b border-solid border-black">
						<div class="flex items-center gap-3">
							<div class="h-3 w-3 rounded-full"></div>
							<span>Active Games</span>
						</div>
						<span>{formatNumber(analyticsData.site.overview.activeGames)}</span>
					</div>
					<div class="flex items-center justify-between border-b border-solid border-black">
						<div class="flex items-center gap-3">
							<div class="h-3 w-3 rounded-full"></div>
							<span>Avg Completion Time</span>
						</div>
						<span>N/A</span>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="h-3 w-3 rounded-full"></div>
							<span>Avg Turns Per Game</span>
						</div>
						<span>N/A</span>
					</div>
				</div>
			</div>

			<!-- Flag Analytics -->
			<div>
				<div>
					<h4 class=" flex items-center gap-2">
						<iconify-icon icon="material-symbols:flag" class="h-5 w-5"></iconify-icon>
						Moderation Analytics
					</h4>
				</div>
				<div class="space-y-4">
					<div class="flex items-center justify-between border-b border-solid border-black">
						<span>Total Flags</span>
						<span>{formatNumber(analyticsData.site.overview.totalFlags)}</span>
					</div>
					<div class="flex items-center justify-between border-b border-solid border-black">
						<span>Resolved</span>
						<span>{formatNumber(analyticsData.site.overview.resolvedFlags)}</span>
					</div>
					<div class="flex items-center justify-between border-b border-solid border-black">
						<span>Pending</span>
						<span>{formatNumber(analyticsData.site.overview.pendingFlags)}</span>
					</div>
					<!-- Flag reasons data not available in overview API -->
				</div>
			</div>
		</div>

		<!-- Top Players -->
		{#if analyticsData.players.topByTurns.length > 0}
			<div>
				<div>
					<h4 class=" flex items-center gap-2">
						<iconify-icon icon="material-symbols:leaderboard" class="h-5 w-5"></iconify-icon>
						Top Players by Activity
					</h4>
				</div>
				<div>
					<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<!-- Top by Total Turns -->
						<div>
							<h5 class=" flex items-center gap-2">
								<iconify-icon icon="material-symbols:trophy" class="h-4 w-4"></iconify-icon>
								Most Active (All Time)
							</h5>
							<div class="space-y-3">
								{#each analyticsData.players.topByTurns.slice(0, 5) as player, index}
									<div
										class="flex items-center justify-between rounded-lg border border-solid border-black"
									>
										<div class="flex items-center gap-3">
											<div class="flex h-8 w-8 items-center justify-center rounded-full">
												{index + 1}
											</div>
											<div>
												<p>{player.username}</p>
											</div>
										</div>
										<div class="text-right">
											<span>{formatNumber(player._count.turns)}</span>
											<p>turns</p>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Most Active Recent -->
						<div>
							<h5 class=" flex items-center gap-2">
								<iconify-icon icon="material-symbols:trending-up" class="h-4 w-4"></iconify-icon>
								Most Active (Last 30 Days)
							</h5>
							<div class="space-y-3">
								{#each analyticsData.players.mostActive.slice(0, 5) as player, index}
									<div
										class="flex items-center justify-between rounded-lg border border-solid border-black"
									>
										<div class="flex items-center gap-3">
											<div class="flex h-8 w-8 items-center justify-center rounded-full">
												{index + 1}
											</div>
											<div>
												<p>{player.username}</p>
											</div>
										</div>
										<div class="text-right">
											<span>{formatNumber(player._count.turns)}</span>
											<p>turns</p>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Footer -->
		<div>
			<p class="flex items-center justify-center gap-2">
				<iconify-icon icon="material-symbols:update" class="h-4 w-4"></iconify-icon>
				Last updated: {new Date(analyticsData.generatedAt).toLocaleString()}
			</p>
		</div>
	{/if}
</div>

<style lang="postcss">
	.analytics-dashboard {
		@apply w-full;
	}

	/* Smooth transitions */
	:global(.analytics-dashboard button) {
		@apply transition-all duration-200;
	}

	/* Enhanced hover effects */
	:global(.analytics-dashboard .player-card:hover) {
		@apply scale-105 transform shadow-md;
	}
</style>

<script lang="ts">
	import type { GameWithTurns, Player, Turn } from '$lib/types/domain';
	import { DAYS, parseDuration, formatDuration } from '$lib/datetime';

	interface Props {
		games: GameWithTurns[];
		players: Player[];
		isParticipant?: boolean;
		currentTime: Date;
		currentUserId?: string;
	}

	const {
		games = [],
		players = [],
		isParticipant = false,
		currentTime,
		currentUserId
	}: Props = $props();

	let hoveredPlayerId = $state<string | null>(null);

	interface ThresholdProps {
		veryBehind: number;
		behind: number;
		stale: number;
		veryStale: number;
	}

	interface TurnDisplay {
		id: string;
		playerId: string;
		playerName: string;
		type: string;
		status: 'done' | 'next' | 'pending';
		isDrawing: boolean;
		completedAt: Date | null;
		createdAt: Date;
		orderIndex: number;
		duration: number;
	}

	interface GameDisplay {
		id: string;
		name: string;
		completedAt: Date | null;
		turns: TurnDisplay[];
		doneTurns: TurnDisplay[];
		gameIndex: number;
	}

	const cellHeight = 60;

	// Use game config timeouts for staleness thresholds
	const thresholds: ThresholdProps = $derived.by(() => {
		if (games.length === 0) {
			return { veryBehind: 3, behind: 2, stale: 2 * DAYS, veryStale: 7 * DAYS };
		}

		const gameConfig = games[0]?.config;
		if (!gameConfig) {
			return { veryBehind: 3, behind: 2, stale: 2 * DAYS, veryStale: 7 * DAYS };
		}

		// Convert minutes to ms for thresholds.
		const writingStaleThresholdMs = parseDuration(gameConfig.writingTimeout) * (2 / 3);
		const writingVeryStaleThresholdMs = parseDuration(gameConfig.writingTimeout);
		const drawingStaleThresholdMs = parseDuration(gameConfig.drawingTimeout) * (2 / 3);
		const drawingVeryStaleThresholdMs = parseDuration(gameConfig.drawingTimeout);

		// For simplicity, we'll use the writing thresholds as the primary ones for the overall grid
		// The individual turn staleness will use the correct drawing/writing timeout
		return {
			veryBehind: 3,
			behind: 2,
			stale: writingStaleThresholdMs,
			veryStale: writingVeryStaleThresholdMs
		};
	});

	// Party duration equals the duration from party start to completion (or current time if incomplete)
	const partyDuration = $derived.by(() => {
		if (games.length === 0) return 30 * DAYS; // 30 days default

		// Find the earliest turn creation time (party start)
		let partyStart = new Date('2099-01-01'); // Initialize to far future
		games.forEach((game) => {
			game.turns.forEach((turn) => {
				const turnStart = new Date(turn.createdAt);
				if (turnStart < partyStart) partyStart = turnStart;
			});
		});

		// Check if all games are complete
		const allGamesComplete = games.every(game => game.completedAt);
		
		if (allGamesComplete) {
			// Use the latest game completion time as party end time
			const partyEnd = Math.max(...games.map(game => 
				game.completedAt ? new Date(game.completedAt).getTime() : 0
			));
			return Math.max(partyEnd - partyStart.getTime(), 1);
		} else {
			// Party duration is from start to current time (party still in progress)
			return Math.max(currentTime.getTime() - partyStart.getTime(), 1);
		}
	});

	function onHoverPlayer(playerId: string | null) {
		hoveredPlayerId = playerId;
	}

	function countDoneTurns(game: GameDisplay) {
		return game.turns.filter((turn) => turn.status === 'done').length;
	}

	function getBehindClass(game: GameDisplay, mostDoneTurns: number) {
		const doneTurns = countDoneTurns(game);
		const currentThresholds = thresholds;
		return mostDoneTurns - doneTurns >= currentThresholds.veryBehind
			? 'very-behind'
			: mostDoneTurns - doneTurns >= currentThresholds.behind
				? 'behind'
				: '';
	}

	function getStaleClass(turn: TurnDisplay): string {
		const gameConfig = games[0]?.config;
		if (!gameConfig) return '';

		const staleThreshold = turn.isDrawing
			? parseDuration(gameConfig.drawingTimeout) * (2 / 3)
			: parseDuration(gameConfig.writingTimeout) * (2 / 3);
		const veryStaleThreshold = turn.isDrawing
			? parseDuration(gameConfig.drawingTimeout)
			: parseDuration(gameConfig.writingTimeout);

		return turn.duration > veryStaleThreshold
			? 'very-stale'
			: turn.duration > staleThreshold
				? 'stale'
				: '';
	}

	const gameDisplays = $derived.by(() => {
		const playerMap = new Map(players.map((p) => [p.id, p]));
		const now = currentTime;

		return games.map((game, gameIndex): GameDisplay => {
			const turns: TurnDisplay[] = game.turns.map((turn: Turn) => {
				const player = playerMap.get(turn.playerId);

				// Calculate turn duration in milliseconds
				const duration = turn.completedAt
					? new Date(turn.completedAt).getTime() - new Date(turn.createdAt).getTime()
					: now.getTime() - new Date(turn.createdAt).getTime();

				let status: 'done' | 'next' | 'pending' = 'pending';
				if (turn.completedAt) {
					status = 'done';
				} else {
					// Find the next turn (oldest incomplete turn)
					const incompleteTurns = game.turns
						.filter((t) => !t.completedAt)
						.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
					if (incompleteTurns.length > 0 && incompleteTurns[0].id === turn.id) {
						status = 'next';
					}
				}

				return {
					id: turn.id,
					playerId: turn.playerId,
					playerName: player?.username || 'Unknown',
					type: turn.isDrawing ? 'image' : 'text',
					status,
					isDrawing: turn.isDrawing,
					completedAt: turn.completedAt,
					createdAt: turn.createdAt,
					orderIndex: turn.orderIndex,
					duration
				};
			});

			const doneTurns = turns.filter((t) => t.status === 'done');

			return {
				id: game.id,
				name: String.fromCharCode(65 + gameIndex), // A, B, C, D, E
				completedAt: game.completedAt,
				turns,
				doneTurns,
				gameIndex: gameIndex + 1
			};
		});
	});

	const mostDoneTurns = $derived.by(() => {
		return Math.max(...gameDisplays.map((g) => countDoneTurns(g)), 0);
	});

	const totalAnticipatedTurns = $derived(players.length * players.length);

	const totalCompletedTurns = $derived(gameDisplays.reduce((sum, game) => sum + game.doneTurns.length, 0));

	const overallPercentage = $derived.by(() => {
		if (totalAnticipatedTurns === 0) return 0;
		return Math.round((totalCompletedTurns / totalAnticipatedTurns) * 100);
	});
</script>

<div class="overall-progress-summary">
	{totalCompletedTurns}/{totalAnticipatedTurns} ({overallPercentage}%) done!
</div>

<div class="progress-grid">
	{#each gameDisplays as game}
		{@const nextTurn = game.turns.find((turn) => turn.status === 'next')}
		<div class="game-row">
			<div
				class="label {game.completedAt
					? 'game-done'
					: `next ${getBehindClass(game, mostDoneTurns)}`}"
			>
				<div class="game-id">{game.name}</div>
				<div class="pc">{game.doneTurns.length}</div>
			</div>
			<div class="turns {game.completedAt ? 'game-done' : ''}" role="row">
				{#each game.turns as turn}
					{@const staleClass = getStaleClass(turn)}
					{@const fontSizeStr =
						turn.status === 'next' && staleClass === 'very-stale' ? 'font-size: 200%' : ''}
					{#if turn.status === 'next'}
						{@const cellTitle = `${turn.type} by ${turn.playerName} ${turn.status === 'next' ? 'at' : 'after'} ${formatDuration(turn.duration)}`}
						<div
							role="cell"
							class="turn next {staleClass} {`turn-${turn.type}`} {`player-${turn.playerId}`} {hoveredPlayerId ===
							turn.playerId
								? 'highlighted'
								: ''}"
							style="width: {(turn.duration * 100) / partyDuration}%"
							title={cellTitle}
							onmouseleave={() => onHoverPlayer(null)}
							tabindex="0"
						>
							<span
								class="name"
								style={fontSizeStr}
								onmouseenter={() => onHoverPlayer(turn.playerId)}
								tabindex="0"
								role="button"
							>
								{turn.playerName}
							</span>
						</div>
					{:else}
						<div
							role="cell"
							class="turn {turn.status} {staleClass} {`turn-${turn.type}`} {`player-${turn.playerId}`} {hoveredPlayerId ===
							turn.playerId
								? 'highlighted'
								: ''}"
							style="width: {(turn.duration * 100) / partyDuration}%"
							title={`${turn.type} by ${turn.playerName} after ${formatDuration(turn.duration)}`}
							onmouseleave={() => onHoverPlayer(null)}
							tabindex="0"
						>
							<span
								class="name"
								role="status"
								style={fontSizeStr}
								onmouseenter={() => onHoverPlayer(turn.playerId)}
							>
								{turn.playerName}
							</span>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/each}
</div>

<style lang="postcss">
	.overall-progress-summary {
		@apply text-center text-lg font-bold mb-4;
	}

	.progress-grid {
		display: flex;
		flex-direction: column;
		gap: 1px;
		background-color: #666;
		border: 1px solid #666;
	}

	.game-row {
		display: flex;
		height: 60px;
		background-color: white;
	}

	.label {
		--highlight-color: #0f0;
		background: var(--highlight-color);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 30px;
		border: none;
		padding: 0;
		position: relative;
		overflow: hidden;
		flex-shrink: 0;

		.game-id,
		.pc {
			font-size: 12px;
			font-weight: bold;
			line-height: 1;
		}

		&.behind {
			--highlight-color: #ff0;
		}
		&.very-behind {
			--highlight-color: #c00;
			background: var(--highlight-color);
			color: #fff;
		}
		&.game-done {
			--highlight-color: #030;
			color: #6f6;
		}
	}

	.turns {
		display: flex;
		flex: 1;
		height: 100%;
		line-height: 60%;

		.turn {
			box-shadow: -1px 0 1px rgba(0, 0, 0, 0.2);
			display: flex;
			background-color: #fff;
			transition: filter 0.2s ease;
			height: 100%;
			border-right: 1px solid #ddd;

			&.turn-image {
				font-style: italic;
				text-decoration: underline;
			}

			&.highlighted {
				background-color: #fff;

				.name {
					rotate: 0deg;
					font-size: 200%;
					position: absolute;
				}

				&.turn-image .name {
					font-style: italic;
					text-decoration: underline;
				}
				&.done {
					text-shadow:
						0 0 2px #fff,
						0 0 4px #fff,
						0 0 6px #fff,
						0 0 8px #fff;
				}
			}

			.name {
				transition:
					font-size 0.2s ease,
					rotate 0.2s ease;
				z-index: 10;
				font-size: 12px;
				white-space: nowrap;
			}

			&.done {
				justify-content: center;
				align-items: center;
				overflow: clip;
				text-align: center;
				container-type: size;

				&.turn-text {
					background-color: #eee;
				}

				&.turn-image {
					background-color: #ddd;
				}
			}

			&.next {
				justify-content: flex-end;
				align-items: center;
				text-wrap: nowrap;
				position: relative;
				font-weight: bold;
				padding-right: 5px;

				.name {
					z-index: 2;
				}

				&.very-behind.stale > * {
					z-index: 2;
				}
			}
		}
	}

	.game-done .turn.done.turn-text,
	.game-done .turn.done.turn-image {
		background-color: #030;
		color: #6f6;
	}

	@container (width < 55px) {
		.name {
			rotate: 90deg;
			font-size: x-small;
		}
	}

	.turn .name {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.turn.next {
		--highlight-color: #0f0;
		--text-shadow-base:
			0 0 2px var(--highlight-color), 0 0 4px var(--highlight-color),
			0 0 6px var(--highlight-color), 0 0 8px var(--highlight-color);
		background: linear-gradient(to right, #fff, var(--highlight-color));
		text-shadow: var(--text-shadow-base);
		cursor: pointer;
		&.stale {
			--highlight-color: #ff0;
		}
		&.very-stale {
			--highlight-color: #900;
			background: repeating-linear-gradient(45deg, #900 0px, #900 5px, #f00 5px, #f00 10px);
			color: #fff;
		}
	}
</style>

import type {
	Turn as PrismaTurn,
	Game as PrismaGame,
	Player as PrismaPlayer,
	TurnFlag as PrismaTurnFlag,
	GameConfig as PrismaGameConfig,
	Notification as PrismaNotification,
	Comment as PrismaComment,
	Season as PrismaSeason,
	PlayersInSeasons as PrismaPlayersInSeasons
} from '@prisma/client';

export interface Turn {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date | null;
	completedAt: Date | null;
	status: 'pending' | 'completed' | 'flagged' | 'rejected'; // sugar, not load-bearing

	gameId: string;
	playerId: string;
	player?: Player;
	content: string;
	isDrawing: boolean;
	orderIndex: number; // 0-based, does not include rejected turns
	rejectedAt: Date | null;
	flags: TurnFlag[];
	flagged?: boolean; // Computed property
	rejected?: boolean; // Computed property
}

export interface GameConfig {
	minTurns: number;
	maxTurns: number | null;
	writingTimeout: string;
	drawingTimeout: string;
	gameTimeout: string;
	isLewd: boolean;
}

export interface Game {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	completedAt: Date | null;
	deletedAt: Date | null;
	expiresAt: Date;
	completedCount: number;
	favoritesCount: number;
	config: GameConfig;
	seasonId?: string;
	isLewd: boolean;
	posterTurnId?: string | null;
}
export interface GameWithTurns extends Game {
	turns: Turn[];
}

export interface Season {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	createdBy: string;
	title: string;
	startDeadline: Date | null;
	status: 'open' | 'active' | 'closed' | 'completed';
	minPlayers: number;
	maxPlayers: number;
	turnPassingAlgorithm: 'round-robin' | 'algorithmic';
	allowPlayerInvites: boolean;
	gameConfig: GameConfig;
	playerIds: string[];
	gameIds: string[];
}

export interface SeasonPlayer {
	seasonId: string;
	playerId: string;
	invitedAt: Date;
	joinedAt: Date | null; // null = invited but not joined
}

export interface SeasonGame {
	seasonId: string;
	gameId: string;
	createdAt: Date;
}

export interface Player {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	username: string;
	imageUrl: string;
	aboutMe: string;
	websiteUrl: string;
	birthday: Date | null;
	hideLewdContent: boolean;
	isAdmin: boolean;
	bannedAt: Date | null;
}

export interface PlayerWithFavorites extends Player {
	favoriteCount: number;
	isFavoritedByCurrentUser: boolean;
}

export interface TurnFlag {
	id: string;
	createdAt: Date;
	turnId: string;
	playerId: string;
	reason: string;
	explanation: string | null;
	resolvedAt: Date | null;
}

export interface Notification {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
	type: string;
	title: string;
	body: string;
	read: boolean;
	data: Record<string, unknown> | null; // JSON data
	actionUrl: string | null; // Optional URL for notification action
}

export interface Comment {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	text: string;
	gameId: string;
	playerId: string;
	player?: Player;
}

export const toDomainTurn = (
	prismaTurn: PrismaTurn & {
		player?: PrismaPlayer;
		flags?: PrismaTurnFlag[];
	}
): Turn => ({
	id: prismaTurn.id,
	createdAt: prismaTurn.createdAt,
	updatedAt: prismaTurn.updatedAt,
	completedAt: prismaTurn.completedAt,
	expiresAt: prismaTurn.expiresAt,
	gameId: prismaTurn.gameId,
	playerId: prismaTurn.playerId,
	player: prismaTurn.player ? toDomainPlayer(prismaTurn.player) : undefined,
	content: prismaTurn.content,
	isDrawing: prismaTurn.isDrawing,
	orderIndex: prismaTurn.orderIndex,
	rejectedAt: prismaTurn.rejectedAt,
	flags: prismaTurn.flags?.map(toDomainTurnFlag) ?? [],
	status: prismaTurn.rejectedAt ? 'rejected' : prismaTurn.completedAt ? 'completed' : 'pending',
	flagged: (prismaTurn.flags?.length ?? 0) > 0 && prismaTurn.flags?.some((f) => !f.resolvedAt),
	rejected: prismaTurn.rejectedAt !== null
});

export const toDomainGame = (
	prismaGame: PrismaGame & {
		turns: PrismaTurn[];
		config: PrismaGameConfig;
		_count?: { favoritedBy: number };
	}
): GameWithTurns | Game => {
	const game = {
		id: prismaGame.id,
		createdAt: prismaGame.createdAt,
		updatedAt: prismaGame.updatedAt,
		completedAt: prismaGame.completedAt,
		deletedAt: prismaGame.deletedAt,
		expiresAt: prismaGame.expiresAt,
		completedCount: prismaGame.turns.filter((t) => t.completedAt).length,
		favoritesCount: prismaGame._count?.favoritedBy ?? 0,
		config: prismaGame.config as GameConfig,
		seasonId: prismaGame.seasonId,
		isLewd: prismaGame.config.isLewd,
		posterTurnId: prismaGame.posterTurnId
	};
	return game as Game;
};

export const toDomainGameWithTurns = (
	prismaGame: PrismaGame & {
		turns: (PrismaTurn & { player?: PrismaPlayer })[];
		config: PrismaGameConfig;
		_count?: { favoritedBy: number };
	}
): GameWithTurns => {
	const game = toDomainGame(prismaGame);
	return {
		...game,
		turns: prismaGame.turns?.map(toDomainTurn) ?? []
	};
};

export const toDomainPlayer = (prismaPlayer: PrismaPlayer): Player => ({
	id: prismaPlayer.id,
	createdAt: prismaPlayer.createdAt,
	updatedAt: prismaPlayer.updatedAt,
	aboutMe: prismaPlayer.aboutMe,
	websiteUrl: prismaPlayer.websiteUrl,
	birthday: prismaPlayer.birthday,
	hideLewdContent: prismaPlayer.hideLewdContent,
	isAdmin: prismaPlayer.isAdmin,
	bannedAt: prismaPlayer.bannedAt,
	username: prismaPlayer.username,
	imageUrl: prismaPlayer.imageUrl
});

export const toDomainTurnFlag = (prismaTurnFlag: PrismaTurnFlag): TurnFlag => ({
	id: prismaTurnFlag.id,
	createdAt: prismaTurnFlag.createdAt,
	turnId: prismaTurnFlag.turnId,
	playerId: prismaTurnFlag.playerId,
	reason: prismaTurnFlag.reason,
	explanation: prismaTurnFlag.explanation,
	resolvedAt: prismaTurnFlag.resolvedAt
});

export const toDomainNotification = (prismaNotification: PrismaNotification): Notification => ({
	id: prismaNotification.id,
	createdAt: prismaNotification.createdAt,
	updatedAt: prismaNotification.updatedAt,
	userId: prismaNotification.userId,
	type: prismaNotification.type,
	title: prismaNotification.title,
	body: prismaNotification.body,
	read: prismaNotification.read,
	data: prismaNotification.data as Record<string, unknown> | null,
	actionUrl: prismaNotification.actionUrl
});

export const toDomainComment = (
	prismaComment: PrismaComment & {
		player?: PrismaPlayer;
	}
): Comment => ({
	id: prismaComment.id,
	createdAt: prismaComment.createdAt,
	updatedAt: prismaComment.updatedAt,
	text: prismaComment.text,
	gameId: prismaComment.gameId,
	playerId: prismaComment.playerId,
	player: prismaComment.player ? toDomainPlayer(prismaComment.player) : undefined
});

export const toDomainSeason = (
	prismaSeason: PrismaSeason & {
		gameConfig: PrismaGameConfig;
		players?: PrismaPlayersInSeasons[];
		games?: PrismaGame[];
	}
): Season => ({
	id: prismaSeason.id,
	createdAt: prismaSeason.createdAt,
	updatedAt: prismaSeason.updatedAt,
	createdBy: prismaSeason.createdBy,
	title: prismaSeason.title,
	startDeadline: prismaSeason.startDeadline,
	status: prismaSeason.status as 'open' | 'active' | 'completed',
	minPlayers: prismaSeason.minPlayers,
	maxPlayers: prismaSeason.maxPlayers,
	turnPassingAlgorithm: prismaSeason.turnPassingAlgorithm as 'round-robin' | 'algorithmic',
	allowPlayerInvites: prismaSeason.allowPlayerInvites,
	gameConfig: prismaSeason.gameConfig as GameConfig,
	playerIds: prismaSeason.players?.map((p) => p.playerId) || [],
	gameIds: prismaSeason.games?.map((g) => g.id) || []
});

export const toDomainSeasonPlayer = (prismaSeasonPlayer: PrismaPlayersInSeasons): SeasonPlayer => ({
	seasonId: prismaSeasonPlayer.seasonId,
	playerId: prismaSeasonPlayer.playerId,
	invitedAt: prismaSeasonPlayer.invitedAt,
	joinedAt: prismaSeasonPlayer.joinedAt
});

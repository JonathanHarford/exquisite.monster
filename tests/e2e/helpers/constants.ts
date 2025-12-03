// Test constants for E2E tests

// Birthday dates for testing age-based functionality
const today = new Date();

// Adult player - 25 years old
export const TEST_PLAYER_BIRTHDAY_ADULT = new Date(
	today.getFullYear() - 25,
	today.getMonth(),
	today.getDate()
)
	.toISOString()
	.split('T')[0];

// Minor player - 16 years old
export const TEST_PLAYER_BIRTHDAY_MINOR = new Date(
	today.getFullYear() - 6,
	today.getMonth(),
	today.getDate()
)
	.toISOString()
	.split('T')[0];

// Exactly 18 years old
export const TEST_PLAYER_BIRTHDAY_EXACTLY_18 = new Date(
	today.getFullYear() - 18,
	today.getMonth(),
	today.getDate()
)
	.toISOString()
	.split('T')[0];

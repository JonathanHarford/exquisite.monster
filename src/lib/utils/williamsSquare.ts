/**
 * A simple pseudo-random number generator for deterministic results based on a seed.
 */
class SeedableRNG {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed;
	}

	/**
	 * Generates the next pseudo-random integer in a sequence.
	 */
	private nextInt(): number {
		// Using a simple LCG (Linear Congruential Generator)
		// These parameters are common for simple LCGs.
		this.seed = (this.seed * 1664525 + 1013904223) % 2 ** 32;
		return this.seed;
	}

	/**
	 * Generates a pseudo-random integer within a specified range [min, max].
	 * @param min The minimum value of the range (inclusive).
	 * @param max The maximum value of the range (inclusive).
	 * @returns A pseudo-random integer.
	 */
	public nextIntInRange(min: number, max: number): number {
		const range = max - min + 1;
		// Get a raw positive integer and map it to the desired range.
		const randomValue = Math.abs(this.nextInt());
		return min + (randomValue % range);
	}
}

/**
 * Calculates the greatest common divisor (GCD) of two numbers using the Euclidean algorithm.
 * @param a The first number.
 * @param b The second number.
 * @returns The GCD of a and b.
 */
function gcd(a: number, b: number): number {
	while (b) {
		[a, b] = [b, a % b];
	}
	return a;
}

/**
 * Finds all numbers between 1 and n-1 that are coprime to n.
 * @param n The number to find coprimes for.
 * @returns An array of numbers coprime to n.
 */
function findCoprimes(n: number): number[] {
	const coprimes: number[] = [];
	for (let i = 1; i < n; i++) {
		if (gcd(i, n) === 1) {
			coprimes.push(i);
		}
	}
	return coprimes;
}

/**
 * Generates a base "Williams" permutation of length n.
 * This specific permutation structure is known to satisfy the pairing constraint.
 * @param n The size of the square.
 * @returns A permutation of numbers from 0 to n-1.
 */
function getWilliamsPermutation(n: number): number[] {
	const p = new Array(n).fill(0);
	if (n % 2 === 0) {
		// Construction for even n
		for (let j = 0; j < n; j++) {
			if (j % 2 === 0) {
				p[j] = j / 2;
			} else {
				p[j] = n - (j + 1) / 2;
			}
		}
	} else {
		// Construction for odd n
		p[0] = 0;
		for (let j = 1; j < n; j++) {
			if (j % 2 !== 0) {
				p[j] = (j + 1) / 2;
			} else {
				p[j] = n - j / 2;
			}
		}
	}
	return p;
}

/**
 * Generates an n x n square of letters with special balancing properties.
 *
 * The properties are:
 * 1. Each row starts with a different letter ('A', 'B', 'C', ...).
 * 2. Each row and column is a permutation of the first n letters (Latin Square).
 * 3. Each letter appears a balanced number of times in even vs. odd columns.
 * 4. Any adjacent pair of letters (e.g., G followed by K) can appear at most twice:
 * once with G in an odd column and K in an even one, and once with G in an
 * even column and K in an odd one.
 *
 * @param n The size of the square. Must be > 3 and <= 26.
 * @param seed A number to seed the random generator for deterministic output.
 * @returns A 2D array of strings representing the generated square.
 */
export function generateSquare(n: number, seed: number): string[][] {
	if (n <= 3) {
		throw new Error('n must be greater than 3.');
	}
	if (n > 26) {
		throw new Error('n cannot be greater than 26, as only standard alphabet characters are used.');
	}

	const rng = new SeedableRNG(seed);

	// The generation method relies on creating a special column permutation `pFinal`.
	// To add variety based on the seed, we can transform a base permutation.
	// This transformation involves multiplying by a number 'a' that is coprime to 'n'.
	const coprimes = findCoprimes(n);
	if (coprimes.length === 0) {
		// This case is only possible for n=1 or n=2, but it's good practice to check.
		throw new Error(`Could not find any coprimes for n=${n}.`);
	}

	// 1. Use the seeded RNG to pick a random coprime 'a'.
	const a = coprimes[rng.nextIntInRange(0, coprimes.length - 1)];

	// 2. Generate the base Williams permutation, which is known to work.
	const pWilliams = getWilliamsPermutation(n);

	// 3. Create the final permutation by transforming the base one.
	// This new permutation also satisfies the necessary constraints.
	// It's important that pFinal[0] remains 0 to satisfy the row-start condition.
	const pFinal = pWilliams.map((p) => (p * a) % n);

	// 4. Construct the numeric grid based on the final permutation.
	// The formula grid[i][j] = (i + pFinal[j]) % n creates a Latin Square
	// that satisfies all the required properties.
	const numericGrid: number[][] = [];
	for (let i = 0; i < n; i++) {
		numericGrid[i] = [];
		for (let j = 0; j < n; j++) {
			numericGrid[i][j] = (i + pFinal[j]) % n;
		}
	}

	// 5. Convert the grid of numbers (0-25) to letters (A-Z).
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const letterGrid = numericGrid.map((row) => row.map((num) => alphabet[num]));

	return letterGrid;
}

/**
 * Analyzes a grid to count the occurrences of each adjacent letter pair.
 * The counts are separated into transitions from an odd-numbered column to an
 * even-numbered one, and vice-versa.
 * @param grid The 2D letter grid to analyze.
 * @returns A map where keys are letters, and values are maps of subsequent
 * letters to their pairing counts.
 */
export function analyzePairings(
	grid: string[][]
): Map<string, Map<string, { oddToEven: number; evenToOdd: number }>> {
	const n = grid.length;
	if (n === 0) {
		return new Map();
	}
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const letters = alphabet.substring(0, n).split('');

	const analysis = new Map<string, Map<string, { oddToEven: number; evenToOdd: number }>>();

	// Initialize the map with all letter pairs set to zero counts.
	for (const fromLetter of letters) {
		const innerMap = new Map<string, { oddToEven: number; evenToOdd: number }>();
		for (const toLetter of letters) {
			innerMap.set(toLetter, { oddToEven: 0, evenToOdd: 0 });
		}
		analysis.set(fromLetter, innerMap);
	}

	// Iterate through the grid to tally the pairs.
	for (let i = 0; i < n; i++) {
		// each row
		for (let j = 0; j < n - 1; j++) {
			// each pair in the row
			const fromLetter = grid[i][j];
			const toLetter = grid[i][j + 1];
			const pairInfo = analysis.get(fromLetter)!.get(toLetter)!;

			// Column indices (j) are 0-based.
			// j=0 is column 1 (Odd) -> transition is Odd-to-Even.
			// j=1 is column 2 (Even) -> transition is Even-to-Odd.
			if (j % 2 === 0) {
				// Odd-to-Even transition
				pairInfo.oddToEven++;
			} else {
				// Even-to-Odd transition
				pairInfo.evenToOdd++;
			}
		}
	}
	return analysis;
}

/**
 * Formats the results of a pairing analysis into a human-readable table.
 * @param analysis The analysis map generated by `analyzePairings`.
 * @returns A string containing the formatted table.
 */
export function formatPairingAnalysis(
	analysis: Map<string, Map<string, { oddToEven: number; evenToOdd: number }>>
): string {
	if (analysis.size === 0) {
		return 'Pairing analysis is not available for an empty grid.';
	}

	const letters = Array.from(analysis.keys()).sort();
	let tableString = 'Pairing Analysis (Odd->Even, Even->Odd counts):\n\n';

	// Header row
	tableString += 'From'.padEnd(6) + letters.map((l) => l.padStart(8)).join('') + '\n';
	tableString += 'To ->'.padEnd(6) + ''.padEnd(letters.length * 8, '-') + '\n';

	// Data rows
	for (const fromLetter of letters) {
		tableString += fromLetter.padEnd(6);
		for (const toLetter of letters) {
			if (fromLetter === toLetter) {
				tableString += '-'.padStart(8);
			} else {
				const counts = analysis.get(fromLetter)!.get(toLetter)!;
				const display = `(${counts.oddToEven},${counts.evenToOdd})`;
				tableString += display.padStart(8);
			}
		}
		tableString += '\n';
	}

	return tableString;
}

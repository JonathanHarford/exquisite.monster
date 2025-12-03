import { formatTimer } from './datetime';

export class Timer {
	private _fullDuration: number;
	private _expirationTime: number;
	private _interval: ReturnType<typeof setInterval> | undefined;
	private _onExpired: () => void;
	private _ms = $state(0);

	constructor(fullDuration: number, onExpired: () => void) {
		this._fullDuration = fullDuration;
		this._onExpired = onExpired;
		this._expirationTime = Date.now() + fullDuration;

		// Initialize the reactive state
		this._updateMs();

		// Update every second
		this._interval = setInterval(() => {
			this._updateMs();
			if (this._ms <= 0) {
				this.cleanup();
				this._onExpired();
			}
		}, 1000);
	}

	private _updateMs() {
		const now = Date.now();
		this._ms = Math.max(0, this._expirationTime - now);
	}

	cleanup() {
		if (this._interval) {
			clearInterval(this._interval);
			this._interval = undefined;
		}
	}

	get formatted() {
		return formatTimer(this._ms);
	}

	get fullDuration() {
		return this._fullDuration;
	}

	get ms() {
		return this._ms;
	}

	get pcDone() {
		return (this._fullDuration - this._ms) / this._fullDuration;
	}

	get seconds() {
		return Math.floor(this._ms / 1000);
	}

	get minutes() {
		return Math.floor(this.seconds / 60);
	}
}

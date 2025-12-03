<script lang="ts">
	import { DAYS, formatDateFull, formatDateShort, formatDuration } from '$lib/datetime';
	const {
		date,
		expires = false // if <0, show stopsign emoji
	}: {
		date: Date | string | null;
		expires?: boolean;
	} = $props();
	const now = new Date();
	const date_obj = $derived(typeof date === 'string' ? new Date(date) : date || now);
	const since = $derived(date_obj ? now.getTime() - date_obj.getTime() : 0);
	const str = $derived.by(() => {
		if (expires && since < 0) {
			// Time is in the future and expires is true - show stop sign
			return '🛑';
		} else if (Math.abs(since) < DAYS) {
			// Less than 24 hours - use formatDuration with "ago" or "in"
			if (since > 0) {
				return formatDuration(since) + ' ago';
			} else {
				return 'in ' + formatDuration(Math.abs(since));
			}
		} else {
			// More than 24 hours - use formatDateShort
			return formatDateShort(date_obj);
		}
	});
</script>

{#if date_obj}
	<span title={formatDateFull(date_obj)}>{str}</span>
{/if}

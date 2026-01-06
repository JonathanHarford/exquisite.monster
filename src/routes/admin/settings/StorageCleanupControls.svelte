<script lang="ts">
	import { Button, Label, Input, Select, Alert, Spinner, Card } from 'flowbite-svelte';
	import { InfoCircleSolid, CheckCircleSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { previewCleanup, runCleanup as executeCleanup } from '../../api/admin/cleanup.remote';

	let cleanupType: 'temporary' | 'orphaned' = $state('temporary');
	let maxAgeHours = $state(24);
	let dryRun = $state(true);
	let immediate = $state(false);
	let isLoading = $state(false);
	let result = $state<any>(null);
	let error = $state<string | null>(null);

	const cleanupTypeOptions = [
		{ value: 'temporary', name: 'Temporary Files (recommended)' },
		{ value: 'orphaned', name: 'Orphaned Files (advanced)' }
	];

	async function runCleanup() {
		if (!confirm('Are you sure you want to run storage cleanup? This action cannot be undone.')) {
			return;
		}

		isLoading = true;
		error = null;
		result = null;

		try {
			const options = {
				type: cleanupType,
				bucketName: 'epyc-storage', // Default used in original code
				directory: 'turns', // Default used in original code
				maxAgeHours: cleanupType === 'temporary' ? maxAgeHours : undefined,
				dryRun: cleanupType === 'orphaned' ? dryRun : false,
				immediate
			};

			result = await executeCleanup(options);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			isLoading = false;
		}
	}

	async function triggerPreview() {
		isLoading = true;
		error = null;
		result = null;

		try {
			const options = {
				type: cleanupType,
				bucketName: 'epyc-storage', // Default
				directory: 'turns', // Default
				...(cleanupType === 'temporary' && { maxAgeHours }),
				...(cleanupType === 'orphaned' && { dryRun: true })
			};

			result = await previewCleanup(options);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			isLoading = false;
		}
	}

	function resetState() {
		result = null;
		error = null;
	}

	$effect(() => {
		// Reset state when cleanup type changes
		resetState();
	});
</script>

<div class="card storage-cleanup-controls">
	<div class="space-y-6">
		<div>
			<h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Storage Cleanup</h4>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Clean up temporary files and orphaned storage to free up space and reduce costs.
			</p>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<Label for="cleanup-type" class="mb-2">Cleanup Type</Label>
				<Select
					id="cleanup-type"
					bind:value={cleanupType}
					items={cleanupTypeOptions}
					placeholder="Select cleanup type"
					onchange={resetState}
				/>
			</div>

			{#if cleanupType === 'temporary'}
				<div>
					<Label for="max-age" class="mb-2">Max Age (hours)</Label>
					<Input
						id="max-age"
						type="number"
						bind:value={maxAgeHours}
						min="1"
						max="8760"
						placeholder="24"
						onchange={resetState}
					/>
				</div>
			{/if}

			{#if cleanupType === 'orphaned'}
				<div class="flex items-center space-x-2">
					<input
						id="dry-run"
						type="checkbox"
						bind:checked={dryRun}
						class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
						onchange={resetState}
					/>
					<Label for="dry-run">Dry Run (preview only)</Label>
				</div>
			{/if}
		</div>

		{#if cleanupType === 'temporary'}
			<Alert color="blue" border class="text-sm">
				<InfoCircleSolid slot="icon" class="w-4 h-4" />
				<span class="font-medium">Temporary Files:</span>
				Removes files matching strict temporary patterns (temp_[13+hexchars].ext, blob-uuid.ext, etc.) 
				older than the specified age. Includes database safety checks to never delete referenced files.
				<strong>ALWAYS preview first!</strong>
			</Alert>
		{/if}

		{#if cleanupType === 'orphaned'}
			<Alert color="yellow" border class="text-sm">
				<ExclamationCircleSolid slot="icon" class="w-4 h-4" />
				<span class="font-medium">Orphaned Files:</span>
				Removes files not referenced in the database. Use dry run first to preview what would be deleted.
				This is more aggressive and should be used carefully.
			</Alert>
		{/if}

		<div class="flex items-center space-x-2 mb-4">
			<input
				id="immediate"
				type="checkbox"
				bind:checked={immediate}
				class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
				onchange={resetState}
			/>
			<Label for="immediate">Run immediately (otherwise schedules for background processing)</Label>
		</div>

		<div class="flex space-x-3">
			<Button color="blue" onclick={triggerPreview} disabled={isLoading}>
				{#if isLoading}
					<Spinner class="mr-2" size="4" />
				{/if}
				Preview Cleanup
			</Button>

			<Button 
				color={cleanupType === 'orphaned' && !dryRun ? 'red' : 'green'} 
				onclick={runCleanup} 
				disabled={isLoading}
			>
				{#if isLoading}
					<Spinner class="mr-2" size="4" />
				{/if}
				{immediate ? 'Run Now' : 'Schedule'} Cleanup
			</Button>
		</div>

		{#if error}
			<Alert color="red" border class="text-sm">
				<ExclamationCircleSolid slot="icon" class="w-4 h-4" />
				<span class="font-medium">Error:</span> {error}
			</Alert>
		{/if}

		{#if result}
			<Alert color="green" border class="text-sm">
				<CheckCircleSolid slot="icon" class="w-4 h-4" />
				<div>
					<span class="font-medium">Success:</span> {result.message}
					
					{#if result.result}
						<div class="mt-2 text-xs space-y-1">
							<div>Files cleaned: <strong>{result.result.cleaned}</strong></div>
							<div>Errors: <strong>{result.result.errors}</strong></div>
							<div>Space freed: <strong>{Math.round(result.result.totalSize / 1024)}KB</strong></div>
							
							{#if result.result.details && result.result.details.length > 0}
								<details class="mt-2">
									<summary class="cursor-pointer font-medium">Details</summary>
									<ul class="mt-1 ml-4 list-disc text-xs">
										{#each result.result.details.slice(0, 10) as detail}
											<li>{detail}</li>
										{/each}
										{#if result.result.details.length > 10}
											<li class="text-gray-500">... and {result.result.details.length - 10} more</li>
										{/if}
									</ul>
								</details>
							{/if}
						</div>
					{/if}

					{#if result.scheduled}
						<div class="mt-2 text-xs">
							<strong>Scheduled:</strong> {result.scheduled.type} cleanup for {result.scheduled.bucketName}/{result.scheduled.directory}
						</div>
					{/if}
				</div>
			</Alert>
		{/if}

		<div class="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded">
			<strong>Automatic Cleanup Schedule:</strong>
			<ul class="mt-1 ml-4 list-disc space-y-1">
				<li>Temporary files: Daily at 2 AM (files older than 24 hours)</li>
				<li>Orphaned files (dry run): Weekly on Sunday at 3 AM</li>
				<li>Orphaned files (deletion): Monthly on 1st at 4 AM</li>
			</ul>
		</div>
	</div>
</div>
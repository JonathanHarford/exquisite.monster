<script lang="ts">
	import { Avatar, Textarea, Button, Card } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import DateComponent from './DateComponent.svelte';
	import type { Comment } from '$lib/types/domain';
	import { SignedIn } from 'svelte-clerk';

	const {
		comments
	}: {
		comments?: Comment[];
	} = $props();
	let commentText = $state('');
</script>

<div class="flex flex-col gap-4">
	<h3>Comments</h3>
	{#if comments && comments.length > 0}
		<div class="flex flex-col gap-4">
			{#each comments as comment (comment.id)}
				<div class="flex items-start gap-3" data-testid="comment">
					<Avatar
						href={`/p/${comment.player?.id}`}
						src={comment.player?.imageUrl}
						alt={comment.player?.username ?? 'User avatar'}
						class="!rounded-full"
						size="sm"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<a href={`/p/${comment.player?.id}`}>
								{comment.player?.username ?? 'Anonymous'}
							</a>
							<DateComponent date={comment.createdAt} />
						</div>
						<Card>
							<p>{comment.text}</p>
						</Card>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<p>No comments yet. Be the first to comment!</p>
	{/if}

	<SignedIn>
		<form method="POST" action="?/addComment" use:enhance>
			<Textarea
				name="text"
				bind:value={commentText}
				placeholder="Add your comment..."
				required
				rows={3}
			/>
			<Button type="submit" color="blue" size="sm">Post Comment</Button>
		</form>
	</SignedIn>
</div>

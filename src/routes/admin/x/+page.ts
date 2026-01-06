import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { self } = await parent();
	const userId = self?.id;

	return {
		userId
	};
};

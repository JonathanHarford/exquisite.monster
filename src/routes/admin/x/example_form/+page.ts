import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { exampleFormSchema } from './schema';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const formSample = await superValidate(
		{
			email: 'test@example.com',
			password: 'password'
		},
		zod4(exampleFormSchema)
	);
	return {
		formSample,
		otherImportantData: 'foo'
	};
};

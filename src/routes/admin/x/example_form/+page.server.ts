import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { exampleFormSchema } from './schema';
import type { Actions } from './$types';

export const actions = {
	default: async ({ request }) => {
		const formSample = await superValidate(request, zod4(exampleFormSchema));

		if (!formSample.valid) {
			return fail(400, { formSample });
		}

		if (Math.random() < 0.7) {
			return setError(formSample, 'email', 'Email is invalid');
		} else {
			return message(formSample, `Check your email to confirm your address change`);
		}
	}
} satisfies Actions;

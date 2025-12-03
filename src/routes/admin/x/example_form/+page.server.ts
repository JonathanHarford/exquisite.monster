import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import type { Actions } from './$types';
// Same as in the client. In practice, this would be in $lib/formSchemas.ts
const schema = z.object({
	email: z.string().email(),
	password: z.string().min(6)
});

export const load = async () => {
	const formSample = await superValidate(
		{
			email: 'test@example.com',
			password: 'password'
		},
		zod4(schema)
	);
	return {
		formSample,
		otherImportantData: 'foo'
	};
};

export const actions = {
	default: async ({ request }) => {
		const formSample = await superValidate(request, zod4(schema));

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

import { z } from 'zod/v4';

export const exampleFormSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6)
});

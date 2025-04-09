import { z } from 'zod';

const VerifierRequest = z.object({
  isAuthenticated: z.boolean(),
  request: z.record(z.string(), z.record(z.record(z.string(), z.boolean()))),
});

export type VerifierRequest = z.infer<typeof VerifierRequest>;

export const parseVerifierRequest = (input: unknown): VerifierRequest => {
  return VerifierRequest.parse(input);
};

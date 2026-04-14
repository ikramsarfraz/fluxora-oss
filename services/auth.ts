import { auth } from "@/lib/auth";

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}) {
  const data = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  return data;
}

/** Row shape returned by `signUp()` (for client `import type` only). */
export type SignUpResponse = Awaited<ReturnType<typeof signUp>>;

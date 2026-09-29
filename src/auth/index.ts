import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Google OAuth only (per spec). Sessions are JWTs; org role is NOT in the
 * token — it is looked up per request against memberships, so a role
 * change takes effect immediately rather than at next sign-in.
 */
const real = NextAuth({
  // Auth.js only auto-reads AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET; the documented
  // GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET names are mapped explicitly.
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user?.email);
    },
  },
});

export const { handlers, signIn, signOut } = real;

// LOCAL TESTING ONLY: DEV_AUTH_EMAIL bypasses Google OAuth and treats every
// request as that user. Never set it in a deployed environment.
const devEmail = process.env.DEV_AUTH_EMAIL;
export const auth = (devEmail
  ? async () => ({ user: { email: devEmail, name: "Dev User" }, expires: "2099-01-01T00:00:00.000Z" })
  : real.auth) as typeof real.auth;

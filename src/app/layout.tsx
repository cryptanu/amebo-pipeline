import "./globals.css";
import type { ReactNode } from "react";
import { Nav } from "./Nav";
import { auth, signOut } from "@/auth";

export const metadata = {
  title: "Amebo — Pipeline Clean",
  description: "Upload your application export, get a screened pipeline.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <html lang="en">
      <body>
        <Nav>
          {email && (
            <form action={doSignOut} className="account">
              <span className="muted">{email}</span>
              <button type="submit" className="ghost">Sign out</button>
            </form>
          )}
        </Nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

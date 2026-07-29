import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";

/**
 * Only ever redirect back to a relative same-origin path. `callbackUrl` comes
 * straight from the query string, so an unvalidated redirect() call here
 * would let a crafted link (?callbackUrl=https://evil.example) send an
 * already-signed-in user to an external site - a classic open-redirect.
 */
function safeCallbackPath(url: string | undefined): string {
  if (url && url.startsWith("/") && !url.startsWith("//") && !url.includes("://")) {
    return url;
  }
  return "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = safeCallbackPath(callbackUrl);

  if (session?.user) {
    redirect(safeCallbackUrl);
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Вхід у {SITE_NAME}</CardTitle>
          <CardDescription>
            Увійдіть через Google, щоб переглядати турніри, рейтинг та власну статистику.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInButton callbackUrl={safeCallbackUrl} />
        </CardContent>
      </Card>
    </div>
  );
}

import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-error";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { SITE_NAME } from "@/lib/site";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  const safeCallbackUrl = safeCallbackPath(callbackUrl);

  if (session?.user) {
    redirect(safeCallbackUrl);
  }

  const errorMessage = authErrorMessage(error);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Вхід у {SITE_NAME}</CardTitle>
          <CardDescription>
            Увійдіть через Google, щоб переглядати турніри, рейтинг та власну статистику.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <SignInButton callbackUrl={safeCallbackUrl} />
        </CardContent>
      </Card>
    </div>
  );
}

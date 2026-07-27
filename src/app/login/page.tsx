import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl ?? "/");
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
          <SignInButton callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </div>
  );
}

import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SignInButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: callbackUrl ?? "/" });
      }}
    >
      <Button type="submit">Увійти через Google</Button>
    </form>
  );
}

import { HomeFooter } from "@/components/home-footer";
import { TripleSplit } from "@/components/triple-split";
import { auth } from "@/lib/auth";
import { getAdminScope } from "@/lib/permissions";
import { getHomePanelSettings } from "@/lib/queries/home-panels";

export default async function HomePage() {
  const [session, panelText] = await Promise.all([auth(), getHomePanelSettings()]);
  const { isSuperAdmin, domains } = getAdminScope(session);
  const padelAuthorized = isSuperAdmin || domains.includes("PADEL");

  return (
    <div className="relative -mx-[50vw] -my-8 left-1/2 right-1/2 w-screen">
      <TripleSplit padelAuthorized={padelAuthorized} panelText={panelText} />
      <HomeFooter />
    </div>
  );
}

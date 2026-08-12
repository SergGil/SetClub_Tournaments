import { HomeFooter } from "@/components/home-footer";
import { TripleSplit } from "@/components/triple-split";
import { SITE_NAME } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="relative -mx-[50vw] -my-8 left-1/2 right-1/2 w-screen">
      <div className="relative">
        <div className="pointer-events-none absolute top-6 left-7 z-30 flex items-center gap-2 text-sm font-bold text-white [text-shadow:0_1px_8px_rgb(0_0_0_/_0.6)]">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          {SITE_NAME}
        </div>
        <TripleSplit />
      </div>
      <HomeFooter />
    </div>
  );
}

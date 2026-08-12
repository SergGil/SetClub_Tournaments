import { HomeFooter } from "@/components/home-footer";
import { TripleSplit } from "@/components/triple-split";

export default function HomePage() {
  return (
    <div className="relative -mx-[50vw] -my-8 left-1/2 right-1/2 w-screen">
      <TripleSplit />
      <HomeFooter />
    </div>
  );
}

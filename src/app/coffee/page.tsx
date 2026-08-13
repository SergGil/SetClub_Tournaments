import { Playfair_Display, PT_Serif } from "next/font/google";
import Image from "next/image";

import { getActiveMenuSections } from "@/lib/queries/menu";
import { publicPhotoUrl } from "@/lib/r2";

const display = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700"],
  variable: "--font-coffee-display",
});

const body = PT_Serif({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-coffee-body",
});

export const metadata = { title: "Кав'ярня" };

export default async function CoffeePage() {
  const sections = await getActiveMenuSections();
  const listSections = sections.filter((s) => s.layout === "LIST");
  const cardSections = sections.filter((s) => s.layout === "CARDS");

  return (
    <div
      className={`${display.variable} ${body.variable} relative left-1/2 right-1/2 -mx-[50vw] -my-8 w-screen bg-[#f7ede1] px-6 py-16 text-[#2b241d]`}
      style={{ fontFamily: "var(--font-coffee-body)" }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-[#5b7a5e] uppercase">Кав&apos;ярня SET.club</p>
          <h1
            className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl"
            style={{ fontFamily: "var(--font-coffee-display)" }}
          >
            Меню
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[#2b241d]/70">
            Спешелті кава, чай і матча в затишному просторі клубу.
          </p>
        </div>

        {listSections.length > 0 && (
          <section className="mt-16">
            <h2
              className="text-center text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-coffee-display)" }}
            >
              Напої
            </h2>
            <div className="mx-auto mt-2 h-px w-16 bg-[#5b7a5e]/40" />

            <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {listSections.map((section) => (
                <div key={section.id}>
                  <h3 className="text-sm font-bold tracking-[0.14em] text-[#5b7a5e] uppercase">
                    {section.name}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {section.items.map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 text-[#2b241d]">
                        <span>{item.name}</span>
                        <span className="h-px flex-1 translate-y-[-4px] border-b border-dotted border-[#2b241d]/25" />
                        <span className="whitespace-nowrap text-[#2b241d]/70">{item.price} грн</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {cardSections.map((section) => (
          <section key={section.id} className="mt-20">
            <div className="text-center">
              {section.tagline && (
                <span className="inline-block rounded-full border border-[#5b7a5e]/40 px-4 py-1 text-xs text-[#5b7a5e] italic">
                  {section.tagline}
                </span>
              )}
              <h2
                className={`mt-4 text-3xl font-bold tracking-tight sm:text-4xl ${
                  section.name.toLowerCase().includes("matcha") ? "text-[#5b7a5e]" : ""
                }`}
                style={{ fontFamily: "var(--font-coffee-display)" }}
              >
                {section.name}
              </h2>
            </div>

            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2">
              {section.items.map((item) => (
                <MenuCard
                  key={item.id}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  photoKey={item.photoKey}
                  accent={section.name.toLowerCase().includes("matcha")}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MenuCard({
  name,
  description,
  price,
  photoKey,
  accent,
}: {
  name: string;
  description: string | null;
  price: number;
  photoKey: string | null;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      {photoKey && (
        <div className="relative mx-auto aspect-[4/5] w-40">
          <Image
            src={publicPhotoUrl(photoKey)}
            alt={name}
            fill
            sizes="160px"
            className="object-contain drop-shadow-[0_8px_10px_rgba(43,36,29,0.18)]"
          />
        </div>
      )}
      <h3
        className={`mt-3 text-xl font-bold ${accent ? "text-[#5b7a5e]" : "text-[#2b241d]"}`}
        style={{ fontFamily: "var(--font-coffee-display)" }}
      >
        {name}
      </h3>
      {description && <p className="mx-auto mt-1 max-w-[26ch] text-sm text-[#2b241d]/70">— {description}</p>}
      <p className="mt-2 text-[#2b241d]/85">{price} грн</p>
    </div>
  );
}

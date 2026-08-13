import Image from "next/image";

import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/site";

const PRICES = [
  {
    label: "Оренда корту",
    price: "400 ₴",
    unit: "1 година",
    description: "Гра на ґрунтовому корті клубу — без розбивки по днях тижня чи часу доби.",
  },
  {
    label: "Прокат інвентаря",
    price: "200 ₴",
    unit: "1 година · 2 ракетки + 3 м'ячики",
    description: "Для тих, хто прийшов без власної ракетки.",
  },
  {
    label: "Корзина м'ячів",
    price: "150 ₴",
    unit: "1 година",
    description: "Для самостійного відпрацювання ударів.",
  },
  {
    label: "Тенісна пушка",
    price: "400 ₴",
    unit: "1 година · + корзина м'ячів",
    description: "Тренування подачі та ударів без партнера — за допомогою машини для подачі м'ячів.",
  },
];

export const metadata = { title: "Ціни" };

export default function TennisPricingPage() {
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] -my-8 w-screen bg-neutral-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium tracking-[0.16em] text-white/50 uppercase">Теніс</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Ціни та послуги</h1>
        <p className="mt-3 max-w-xl text-white/60">
          У клубі ґрунтові корти. Ціни фіксовані — без розбивки по годинах чи буднях/вихідних.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-zinc-800">
            <Image
              src="/pricing/prices.jpg"
              alt="Прайс клубу SET.club: оренда корту, прокат інвентаря, корзина м'ячів, тенісна пушка"
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
            />
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800 sm:grid-cols-2">
            {PRICES.map((item) => (
              <PriceBlock key={item.label} {...item} />
            ))}
          </div>
        </div>

        <p className="mt-8 text-sm text-white/40">
          Бронювання та уточнення — за телефоном клубу:{" "}
          <a className="text-white/70 underline underline-offset-4 hover:text-white" href={SITE_PHONE_TEL}>
            {SITE_PHONE}
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function PriceBlock({
  label,
  unit,
  price,
  description,
}: {
  label: string;
  unit: string;
  price: string;
  description: string;
}) {
  return (
    <div className="bg-neutral-950 p-8">
      <div className="text-sm text-white/50">{label}</div>
      <div className="mt-3 text-4xl font-extrabold tracking-tight">{price}</div>
      <div className="mt-1 text-sm text-white/40">{unit}</div>
      <p className="mt-3 text-sm text-white/60">{description}</p>
    </div>
  );
}

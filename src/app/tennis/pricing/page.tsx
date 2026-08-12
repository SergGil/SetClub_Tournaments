// Ціна — плейсхолдер (docs/HOMEPAGE.md), користувач підставить реальну вартість.
const PRICE_PLACEHOLDER = "XXXX ₴";
const PHONE_TEL = "tel:+380000000000";
const PHONE_PLACEHOLDER = "+380 XX XXX XX XX";

export const metadata = { title: "Ціни" };

export default function TennisPricingPage() {
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] -my-8 w-screen bg-neutral-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-medium tracking-[0.16em] text-white/50 uppercase">Теніс</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Ціни та послуги</h1>
        <p className="mt-3 max-w-xl text-white/60">
          У клубі ґрунтові корти. Ціна фіксована — без розбивки по годинах чи буднях/вихідних.
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800 sm:grid-cols-2">
          <PriceBlock label="Оренда корту" unit="1 година" price={PRICE_PLACEHOLDER} />
          <PriceBlock label="Індивідуальне тренування" unit="1 година, з тренером" price={PRICE_PLACEHOLDER} />
        </div>

        <p className="mt-8 text-sm text-white/40">
          Бронювання та уточнення — за телефоном клубу:{" "}
          <a className="text-white/70 underline underline-offset-4 hover:text-white" href={PHONE_TEL}>
            {PHONE_PLACEHOLDER}
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function PriceBlock({ label, unit, price }: { label: string; unit: string; price: string }) {
  return (
    <div className="bg-neutral-950 p-8">
      <div className="text-sm text-white/50">{label}</div>
      <div className="mt-3 text-4xl font-extrabold tracking-tight">{price}</div>
      <div className="mt-1 text-sm text-white/40">{unit}</div>
    </div>
  );
}

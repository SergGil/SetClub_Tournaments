import { Playfair_Display, PT_Serif } from "next/font/google";
import Image from "next/image";

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

// Меню перенесено з фото, які надав клуб (public/coffee/*.jpg) - три окремі
// дошки: базові напої, "Special Menu" і "Matcha Menu". Фото окремих напоїв
// (public/coffee/drinks/*.png) вирізані sharp-ом із цих же трьох композитних
// дошок і знефонені (flood-fill з країв у прозорість, бо фон дошки трохи
// відрізнявся відтінком від фону сторінки) - оригінальних окремих фото
// напоїв клуб не має.
const DRINK_GROUPS = [
  {
    title: "Кава",
    items: [
      { name: "Еспресо", price: 60 },
      { name: "Допіо", price: 80 },
      { name: "Американо", price: 65 },
      { name: "Подвійне американо", price: 85 },
      { name: "Флет-вайт", price: 90 },
      { name: "Капучино", price: 90 },
      { name: "Лате", price: 95 },
      { name: "Мокка", price: 90 },
      { name: "Фраппе", price: 95 },
      { name: "Айс-лате", price: 95 },
      { name: "Бамбл", price: 95 },
      { name: "Еспресо-тонік", price: 95 },
    ],
  },
  {
    title: "Чай",
    items: [
      { name: "Розсипний чай", price: 50 },
      { name: "Чай пакетований (пюре)", price: 70 },
    ],
  },
  {
    title: "Матча",
    items: [
      { name: "Матча-лате", price: 125 },
      { name: "Айс-матча", price: 135 },
    ],
  },
  {
    title: "Інше",
    items: [
      { name: "Молочний коктейль", price: 80 },
      { name: "Какао", price: 90 },
      { name: "Айс-какао", price: 80 },
      { name: "Лимонад", price: 60 },
    ],
  },
];

const SPECIAL_MENU = [
  {
    name: "Sabrina Carpenter",
    description: "лимонад з вершково-вишневим смаком та блю-кюрасао",
    price: 95,
    photo: "/coffee/drinks/sabrina-carpenter.png",
  },
  {
    name: "Оранж-шоколате",
    description: "апельсинове айс-лате з шоколадом",
    price: 110,
    photo: "/coffee/drinks/oranzh-shokolate.png",
  },
  {
    name: "Айс-тірамісу",
    description: "айс-какао з вершковим смаком тірамісу",
    price: 120,
    photo: "/coffee/drinks/ais-tiramisu.png",
  },
  {
    name: "Коко-фіз",
    description: "освіжаючий кокосовий лимонад",
    price: 100,
    photo: "/coffee/drinks/koko-fiz.png",
  },
  {
    name: "Тропік брю",
    description: "еспресо з лаймово-кокосовим вершковим спрайтом",
    price: 120,
    photo: "/coffee/drinks/tropik-brew.png",
  },
  {
    name: "Імбирне айс-лате",
    description: "айс-лате імбирний пряник з вершковою піною",
    price: 110,
    photo: "/coffee/drinks/imbyrne-ais-late.png",
  },
];

const MATCHA_MENU = [
  {
    name: "Матча-манго",
    description: "матча з пюре манго",
    price: 145,
    photo: "/coffee/drinks/matcha-mango.png",
  },
  {
    name: "Кокосова матча",
    description: "айс-матча з кокосовою холодною піною",
    price: 165,
    photo: "/coffee/drinks/kokosova-matcha.png",
  },
  {
    name: "Матча-полуниця",
    description: "айс-матча з полуничним сиропом",
    price: 140,
    photo: "/coffee/drinks/matcha-polunytsia.png",
  },
  {
    name: "Матча-оранж",
    description: "матча з апельсиновим соком",
    price: 135,
    photo: "/coffee/drinks/matcha-oranzh.png",
  },
  {
    name: "Малинова матча-сода",
    description: "малинове пюре, шот матчі та газована вода",
    price: 135,
    photo: "/coffee/drinks/malynova-matcha-soda.png",
  },
  {
    name: "Матча-малина",
    description: "айс-матча з малиновим пюре",
    price: 150,
    photo: "/coffee/drinks/matcha-malyna.png",
  },
];

export default function CoffeePage() {
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
            Спешелті кава, чай і матча в затишному просторі клубу. Ціни фіксовані, без сервісного
            збору.
          </p>
        </div>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-coffee-display)" }}>
            Напої
          </h2>
          <div className="mx-auto mt-2 h-px w-16 bg-[#5b7a5e]/40" />

          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {DRINK_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-bold tracking-[0.14em] text-[#5b7a5e] uppercase">{group.title}</h3>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.items.map((item) => (
                    <li key={item.name} className="flex items-baseline justify-between gap-3 text-[#2b241d]">
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

        <section className="mt-20">
          <div className="text-center">
            <span className="inline-block rounded-full border border-[#5b7a5e]/40 px-4 py-1 text-xs text-[#5b7a5e] italic">
              special drinks
            </span>
            <h2
              className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-coffee-display)" }}
            >
              Special Menu
            </h2>
          </div>

          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {SPECIAL_MENU.map((item) => (
              <MenuCard key={item.name} {...item} />
            ))}
          </div>
        </section>

        <section className="mt-20">
          <div className="text-center">
            <span className="inline-block rounded-full border border-[#5b7a5e]/40 px-4 py-1 text-xs text-[#5b7a5e] italic">
              love yourself, drink matcha
            </span>
            <h2
              className="mt-4 text-3xl font-bold tracking-tight text-[#5b7a5e] sm:text-4xl"
              style={{ fontFamily: "var(--font-coffee-display)" }}
            >
              Matcha Menu
            </h2>
          </div>

          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {MATCHA_MENU.map((item) => (
              <MenuCard key={item.name} {...item} accent />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MenuCard({
  name,
  description,
  price,
  photo,
  accent,
}: {
  name: string;
  description: string;
  price: number;
  photo: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="relative mx-auto aspect-[4/5] w-40">
        <Image src={photo} alt={name} fill sizes="160px" className="object-contain drop-shadow-[0_8px_10px_rgba(43,36,29,0.18)]" />
      </div>
      <h3
        className={`mt-3 text-xl font-bold ${accent ? "text-[#5b7a5e]" : "text-[#2b241d]"}`}
        style={{ fontFamily: "var(--font-coffee-display)" }}
      >
        {name}
      </h3>
      <p className="mx-auto mt-1 max-w-[26ch] text-sm text-[#2b241d]/70">— {description}</p>
      <p className="mt-2 text-[#2b241d]/85">{price} грн</p>
    </div>
  );
}

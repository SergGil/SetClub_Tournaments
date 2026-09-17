import Image from "next/image";

import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/site";

export const metadata = { title: "Тренери" };

const COACHES = [
  {
    name: "Іоганов Денис",
    photo: "/coaches/denys-iohanov.png",
    bio: [
      "Сімнадцятиразовий переможець турніру «Дружній» в Одесі",
      "Має 17-річний досвід гри",
      "Готовий допомогти покращити ваші навички та впевненість на корті",
      "Індивідуальний підхід та захоплюючі тренування для будь-якого рівня підготовки",
    ],
  },
  {
    name: "Кулєш Ірина",
    photo: "/coaches/iryna-kulesh.jpg",
    bio: [
      "Учасниця та фіналістка міських змагань в одиночному та парному розрядах",
      "Закохана у теніс вже 17 років",
      "Бажає передавати свої знання та досвід усім відданим цьому спорту",
    ],
  },
  {
    name: "Чаура Ліна",
    photo: "/coaches/lina-chaura.jpg",
    bio: [
      "Учасниця та переможниця міських змагань в одиночному, парному та змішаному розрядах",
      "Займається великим тенісом вже більше 20 років",
      "Прагне закохати всіх бажаючих у цю неймовірну гру",
    ],
  },
];

export default function CoachesPage() {
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] -my-8 w-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Теніс</p>
        <h1
          className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Тренери клубу
        </h1>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COACHES.map((coach) => (
            <div key={coach.name} className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                <Image
                  src={coach.photo}
                  alt={coach.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="text-sm font-semibold">{coach.name}</div>
              {coach.bio.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {coach.bio.map((line) => (
                    <li key={line} className="text-xs text-muted-foreground">
                      • {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-border px-8 py-10 text-center">
          <p className="text-lg font-medium text-foreground/90">
            Запис на тренування здійснюється виключно за телефоном клубу:
          </p>
          <a
            href={SITE_PHONE_TEL}
            className="mt-2 inline-block text-2xl font-bold tracking-tight text-foreground underline underline-offset-4 hover:text-primary"
          >
            {SITE_PHONE}
          </a>
        </div>
      </div>
    </div>
  );
}

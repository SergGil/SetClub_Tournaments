export type TennisCoach = { name: string; photo: string; bio: string[] };

// Lives here rather than inside /tennis/coaches/page.tsx because that page's
// search description (section-seo.ts) names the coaches too - one list, so a
// new or departing coach can't leave Google showing a stale name.
export const TENNIS_COACHES: TennisCoach[] = [
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

export type TennisPrice = { label: string; price: string; unit: string; description: string };

// Lives here rather than inside /tennis/pricing/page.tsx because the homepage's
// "about" answers (home-about.ts) and the Markdown/llms.txt copies for AI agents
// quote the court price too - one source, so a price change can't leave the
// homepage saying something different from the pricing page.
export const COURT_RENTAL: TennisPrice = {
  label: "Оренда корту",
  price: "400 ₴",
  unit: "1 година",
  description: "Гра на ґрунтовому корті клубу — без розбивки по днях тижня чи часу доби.",
};

export const EQUIPMENT_RENTAL: TennisPrice = {
  label: "Прокат інвентаря",
  price: "200 ₴",
  unit: "1 година · 2 ракетки + 3 м'ячики",
  description: "Для тих, хто прийшов без власної ракетки.",
};

export const BALL_BASKET: TennisPrice = {
  label: "Корзина м'ячів",
  price: "150 ₴",
  unit: "1 година",
  description: "Для самостійного відпрацювання ударів.",
};

export const BALL_MACHINE: TennisPrice = {
  label: "Тенісна пушка",
  price: "400 ₴",
  unit: "1 година · + корзина м'ячів",
  description: "Тренування подачі та ударів без партнера — за допомогою машини для подачі м'ячів.",
};

export const TENNIS_PRICES: TennisPrice[] = [COURT_RENTAL, EQUIPMENT_RENTAL, BALL_BASKET, BALL_MACHINE];

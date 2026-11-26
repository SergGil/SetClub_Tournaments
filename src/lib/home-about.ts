import { GOOGLE_MAPS_URL, SITE_NAME, SITE_PHONE } from "@/lib/site";
import { COURT_RENTAL, EQUIPMENT_RENTAL } from "@/lib/tennis-pricing";

/**
 * Plain-text "about the club" copy for the homepage - rendered as HTML by
 * HomeAbout (components/home-about.tsx) and as Markdown for AI agents by
 * agent-markdown.ts (`/index.md`, `/llms.txt`), so both always say the same
 * thing. See docs/SEO.md ("AI-готовність").
 *
 * Why it exists: the homepage is almost entirely visual (TripleSplit photos,
 * marquee, stat numbers), so without JavaScript an AI/search crawler saw ~125
 * words and no <h1>. Each answer is written to be quoted on its own:
 * 1-2 sentences, 40-320 characters, directly under its question heading
 * (tests/lib/home-about.test.ts enforces that). Avoid abbreviations ending
 * in a period ("м.", "обл.") - naive sentence splitters count them as
 * sentence ends.
 *
 * Only state facts the rest of the site already backs up (pricing, school,
 * coaches, rating pages) - an AI engine will repeat these verbatim.
 */

/** The homepage's <title> and <h1>: brand first, so it matches the JSON-LD name and og:site_name. */
export const HOME_TITLE = `${SITE_NAME} — тенісний клуб, кава та падел у Південному`;

export const HOME_INTRO =
  `${SITE_NAME} — тенісний клуб у місті Південне Одеської області: ґрунтові корти, ` +
  "школа тенісу для дітей, кав'ярня з кавою, чаєм і великим матча-меню, а також падел-корти, що зараз будуються. " +
  "На цьому сайті клуб публікує турніри, результати матчів, рейтинг і профілі гравців.";

export type HomeFaqItem = {
  question: string;
  answer: string;
  /** A site path ("/tennis/pricing") or an absolute external URL (Google Maps) - see isExternalHref. */
  link?: { href: string; label: string };
};

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export const HOME_FAQ: readonly HomeFaqItem[] = [
  {
    question: `Де знаходиться ${SITE_NAME}?`,
    answer:
      `${SITE_NAME} розташований у місті Південне Одеської області. ` +
      `Щоб дізнатися дорогу або домовитися про гру, телефонуйте за номером ${SITE_PHONE}.`,
    link: { href: GOOGLE_MAPS_URL, label: "Відкрити на карті" },
  },
  {
    question: "Скільки коштує оренда тенісного корту?",
    answer:
      `Година гри на ґрунтовому корті коштує ${COURT_RENTAL.price} — ціна однакова в будні й вихідні ` +
      `та в будь-який час доби. Прокат інвентаря — ${EQUIPMENT_RENTAL.price} за годину.`,
    link: { href: "/tennis/pricing", label: "Усі ціни" },
  },
  {
    question: "Як забронювати корт або тренування?",
    answer:
      `Корт і тренування з тренером бронюються за телефоном клубу ${SITE_PHONE}. ` +
      "Тренери клубу працюють із гравцями будь-якого рівня підготовки.",
    link: { href: "/tennis/coaches", label: "Тренери" },
  },
  {
    question: "Чи є в клубі тенісна школа для дітей?",
    answer:
      `Так, школа тенісу ${SITE_NAME} набирає дітей від 4 років, а групи формуються за віком. ` +
      "Записати дитину можна за телефоном клубу.",
    link: { href: "/tennis/school", label: "Школа тенісу" },
  },
  {
    question: `Які турніри проводить ${SITE_NAME}?`,
    answer:
      "Клуб проводить тенісні турніри в одиночному (1×1), парному (2×2) та змішаному форматах. " +
      "Сітки, рахунки матчів і підсумкові місця кожного турніру публікуються на сайті.",
    link: { href: "/tournaments", label: "Турніри" },
  },
  {
    question: "Як рахується рейтинг гравців?",
    answer:
      `Основний рейтинг ${SITE_NAME} нараховує гравцям бали за місця, які вони посіли в турнірах сезону. ` +
      "Моделі Glicko-2 (одиночні) та OpenSkill (парні) додатково оцінюють силу гравця з урахуванням суперників і рахунку геймів.",
    link: { href: "/rating", label: "Рейтинг" },
  },
  {
    question: "Чи можна переглянути власну статистику?",
    answer:
      "Так, кожен учасник турнірів має профіль з історією матчів, перемогами та рейтингом. " +
      "Увійдіть через Google, щоб пов'язати акаунт із власним профілем.",
    link: { href: "/players", label: "Гравці" },
  },
  {
    question: "Що можна замовити в кав'ярні?",
    answer:
      // "з матчею"/"матча-меню", never "матчі": on a tennis site that also reads as "matches".
      `Кав'ярня ${SITE_NAME} готує каву, чай і авторські напої, а в окремому матча-меню — багато різних напоїв з матчею. ` +
      "Актуальне меню з цінами є на сторінці кав'ярні.",
    link: { href: "/coffee", label: "Меню" },
  },
  {
    question: "Коли відкриється падел?",
    answer:
      `Падел-корти ${SITE_NAME} зараз будуються, і секція відкриється після завершення робіт. ` +
      "Слідкуйте за новинами клубу.",
    link: { href: "/news", label: "Новини" },
  },
];

/**
 * The public sections an AI agent should know about, in reading order - for
 * llms.txt and the homepage's Markdown version. Deliberately leaves out
 * /padel/* (admin-only until the courts open, see padel/page.tsx), /admin,
 * /login and /api.
 */
export const PUBLIC_SECTIONS: readonly { path: string; label: string; description: string }[] = [
  { path: "/tennis", label: "Теніс", description: "головна сторінка тенісного клубу: останні результати й новини" },
  { path: "/tournaments", label: "Турніри", description: "усі турніри клубу з сітками, рахунками та підсумковими місцями" },
  { path: "/matches", label: "Матчі", description: "стрічка матчів клубу з рахунками" },
  { path: "/rating", label: "Рейтинг", description: "рейтинг гравців (бали SET.club, Glicko-2, OpenSkill) і як він рахується" },
  { path: "/leaderboard", label: "Статистика", description: "перемоги, поразки та відсоток перемог кожного учасника" },
  { path: "/players", label: "Гравці", description: "профілі гравців з історією матчів і досягненнями" },
  { path: "/tennis/pricing", label: "Ціни", description: "оренда корту, прокат інвентаря, корзина м'ячів, тенісна пушка" },
  { path: "/tennis/school", label: "Школа тенісу", description: "набір дітей від 4 років, групи за віком" },
  { path: "/tennis/coaches", label: "Тренери", description: "тренери клубу та їхній досвід" },
  { path: "/coffee", label: "Кав'ярня", description: "меню кав'ярні з цінами" },
  { path: "/news", label: "Новини", description: "новини та оголошення клубу" },
  { path: "/gallery", label: "Фото", description: "фотоальбоми турнірів" },
];

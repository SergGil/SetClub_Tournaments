import Image from "next/image";

export const metadata = { title: "Тренери" };

const COACHES = [
  {
    name: "Іоганов Денис",
    photo: "/coaches/denys-iohanov.png",
  },
  {
    name: "Кулєш Ірина",
    photo: "/coaches/iryna-kulesh.jpg",
  },
  {
    name: "Чаура Ліна",
    photo: "/coaches/lina-chaura.jpg",
  },
];

const PHONE_TEL = "tel:+380000000000";
const PHONE_PLACEHOLDER = "+380 XX XXX XX XX";

export default function CoachesPage() {
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] -my-8 w-screen bg-neutral-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium tracking-[0.16em] text-white/50 uppercase">Теніс</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Тренери клубу</h1>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {COACHES.map((coach) => (
            <div key={coach.name} className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900">
                <Image
                  src={coach.photo}
                  alt={coach.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="text-sm font-semibold">{coach.name}</div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-zinc-800 px-8 py-10 text-center">
          <p className="text-lg font-medium text-white/90">
            Запис на тренування здійснюється виключно за телефоном клубу:
          </p>
          <a
            href={PHONE_TEL}
            className="mt-2 inline-block text-2xl font-bold tracking-tight text-white underline underline-offset-4 hover:text-primary"
          >
            {PHONE_PLACEHOLDER}
          </a>
        </div>
      </div>
    </div>
  );
}

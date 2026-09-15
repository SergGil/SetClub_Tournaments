import Image from "next/image";

import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/site";

export const metadata = { title: "Школа тенісу" };

const GROUPS = [
  { name: "MIMI", age: "4-5 років", photo: "/school/mimi.jpg" },
  { name: "MINI", age: "6-7 років", photo: "/school/mini.jpg" },
  { name: "KIDS", age: "8-9 років", photo: "/school/kids.jpg" },
  { name: "TEENS", age: "12-14 років", photo: "/school/teens.jpg" },
];

export default function TennisSchoolPage() {
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] -my-8 w-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Теніс</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Набір у школу тенісу</h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          Приймаємо дітей від 4 років. Групи формуються за віком, аби кожній дитині було цікаво та
          комфортно навчатись.
        </p>

        <div className="relative mt-10 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border sm:aspect-[16/9]">
          <Image
            src="/school/school.jpg"
            alt="Набір у школу тенісу SET.club"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
            priority
          />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {GROUPS.map((group) => (
            <div key={group.name} className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                <Image
                  src={group.photo}
                  alt={`Група "${group.name}", ${group.age}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="text-sm font-semibold">Група &quot;{group.name}&quot;</div>
              <div className="text-xs text-muted-foreground">діти {group.age}</div>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <h2 className="text-lg font-semibold">Відео зі школи</h2>
          <video
            className="mt-4 w-full rounded-2xl border border-border"
            src="/school/school-enrollment.mp4"
            poster="/school/school.jpg"
            controls
            playsInline
          />
        </div>

        <div className="mt-14 rounded-2xl border border-border px-8 py-10 text-center">
          <p className="text-lg font-medium text-foreground/90">
            Запис у школу тенісу здійснюється за телефоном клубу:
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

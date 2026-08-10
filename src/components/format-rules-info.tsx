"use client";

import { InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormatRulesKind } from "@/lib/tournament-standings";
import type { TournamentFormat } from "@/lib/validation/tournament";

function GroupsRules({ format }: { format: TournamentFormat }) {
  const isDoubles = format === "DOUBLES";
  return (
    <>
      <DialogHeader>
        <DialogTitle>Формат турніру: За групами</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 text-sm">
        <p>
          {isDoubles ? "Пари" : "Учасників"} розподілено по групах — адміном вручну в ростері, або
          рандомайзером «За групами» (за наявності — випадково й порівну домішуючи ще не розподілених).
        </p>
        <p>
          Усередині своєї групи{" "}
          {isDoubles ? "кожна пара грає з кожною іншою парою тієї ж групи" : "кожен гравець грає з кожним іншим"}{" "}
          — кругова система.
        </p>
        <p>
          {isDoubles ? "Пари" : "Гравці"} різних груп між собою не зустрічаються, і їхні результати
          напряму не порівнюються — кожна група має власну таблицю «Матчів»/«Перемог».
        </p>
        <p className="text-muted-foreground">
          Якщо пізніше адмін додасть матчі плей-офф між переможцями різних груп (наприклад, Фінал,
          За 3 місце), у турнірі з&apos;явиться «Підсумкова таблиця» з реальними місцями по
          всьому турніру — а не лише в межах своєї групи.
        </p>
      </div>
    </>
  );
}

function SeededSplitRules() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Формат турніру: За сіяністю</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 text-sm">
        <p>
          Гравців поділено на «сіяних» і «несіяних» — адмін позначає сіяність вручну в ростері
          турніру.
        </p>
        <p>
          Сіяні грають круговою системою лише між собою (таблиця <span className="font-medium">Gold</span>
          ), несіяні — лише між собою (таблиця <span className="font-medium">Silver</span>); сіяні й
          несіяні один з одним не зустрічаються.
        </p>
        <p className="text-muted-foreground">
          Використовується, коли рівень гравців у турнірі помітно різний, щоб забезпечити
          конкурентні матчі в межах кожної підгрупи, а не односторонні перемоги сильних над слабкими.
        </p>
      </div>
    </>
  );
}

function Groups12PlayoffRules() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Формат турніру: 4 групи по 3 + плей-офф</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 text-sm">
        <p>
          <span className="font-medium">Груповий етап.</span> 4 групи (A-D) по 3 гравці, в кожній
          групі — 1 сіяний гравець (розподілений випадково). Усередині групи кожен грає з кожним.
        </p>
        <p>
          <span className="font-medium">Плей-офф за 1-4 місце.</span> Чвертьфінали: 1-ше місце
          групи A проти 2-го місця групи C, 1-ше місце групи C проти 2-го місця групи A, 1-ше
          місце групи B проти 2-го місця групи D, 1-ше місце групи D проти 2-го місця групи B.
          Переможці чвертьфіналів грають у півфіналі, переможці півфіналів — у фіналі, програвші
          півфіналів — у матчі за 3-тє місце.
        </p>
        <p>
          <span className="font-medium">Матчі за 5-8 місце.</span> Програвші чвертьфіналів
          грають між собою (втішний півфінал); переможці цих матчів зустрічаються за 5-те місце,
          програвші — за 7-ме.
        </p>
        <p>
          <span className="font-medium">Місця 9-12.</span> Гравці, що посіли 3-тє місце у своїх
          групах, грають міні-турнір між собою (кожен з кожним) — за його підсумками визначаються
          місця 9-12.
        </p>
        <p className="text-muted-foreground">
          Усі матчі сітки створюються одразу після групового етапу і заповнюються учасниками
          автоматично, щойно відповідні матчі/групи завершені.
        </p>
      </div>
    </>
  );
}

/**
 * Explains, in plain language, which randomizer-shaped format actually
 * produced this tournament's structure - not just for admins, since a
 * player/spectator often can't tell "who plays whom" from the standings
 * tables alone (e.g. why don't the top two groups' leaders ever meet?).
 * Content is picked by `kind` (see FormatRulesKind's own doc comment for
 * how it's detected) rather than being hardcoded to one format the way this
 * component originally only covered GROUPS_12_PLAYOFF.
 */
export function FormatRulesButton({ kind, format }: { kind: FormatRulesKind; format: TournamentFormat }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <InfoIcon /> Правила формату
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        {kind === "GROUPS_12_PLAYOFF" && <Groups12PlayoffRules />}
        {kind === "CUSTOM_GROUPS" && <GroupsRules format={format} />}
        {kind === "SEEDED_SPLIT" && <SeededSplitRules />}
      </DialogContent>
    </Dialog>
  );
}

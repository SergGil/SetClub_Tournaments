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

/**
 * Explains the fixed "4 групи по 3 + плей-офф" bracket rules (see
 * docs/GROUPS12_PLAYOFF.md) in plain language for players/spectators, not
 * just admins - the format has enough structure (group stage, a 1-4 playoff,
 * a separate 5-8 placement bracket, and a 9-12 mini-group) that "who plays
 * whom in 1/4" isn't obvious from the standings tables alone. Content is
 * static (the topology never varies - only who ends up in which slot does,
 * and that's already visible once decided in the match list itself).
 */
export function Groups12PlayoffInfoButton() {
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
      </DialogContent>
    </Dialog>
  );
}

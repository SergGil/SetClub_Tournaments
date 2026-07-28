"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "ALL";

export function OpponentFilter({
  opponents,
  selectedId,
}: {
  opponents: { id: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const items = {
    [ALL]: "Усі суперники",
    ...Object.fromEntries(opponents.map((o) => [o.id, o.name])),
  };

  return (
    <Select
      items={items}
      value={selectedId || ALL}
      onValueChange={(value) => {
        router.push(!value || value === ALL ? pathname : `${pathname}?opponent=${value}`);
      }}
    >
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Усі суперники</SelectItem>
        {opponents.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

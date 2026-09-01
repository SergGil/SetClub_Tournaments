import { z } from "zod";

import { matchTypeValues } from "@/lib/validation/match";

// Unlike matchFormSchema's playerIdList (min(0), a bracket-placeholder slot
// filled in later), a rubber is always created with its lineup already
// decided - there's no bracket-advancement wiring for ties in v1, so an
// empty side would just be a mistake, not a legitimate placeholder.
const teamPlayerIdList = z.array(z.string().min(1)).min(1).max(2);

export const rubberFormSchema = z
  .object({
    tieId: z.string().min(1),
    matchType: z.enum(matchTypeValues),
    scheduledDate: z
      .union([z.literal(""), z.string()])
      .optional()
      .transform((value) => value || null),
    sideAPlayerIds: teamPlayerIdList,
    sideBPlayerIds: teamPlayerIdList,
  })
  .refine((data) => data.sideAPlayerIds.length === data.sideBPlayerIds.length, {
    message: "Кількість гравців має бути однаковою з обох сторін",
    path: ["sideBPlayerIds"],
  })
  .refine((data) => data.sideAPlayerIds.length <= (data.matchType === "SINGLES" ? 1 : 2), {
    message: "Для одиночного раббера можна вказати не більше 1 гравця на сторону, для парного — не більше 2",
    path: ["sideAPlayerIds"],
  })
  .refine(
    (data) => {
      const all = [...data.sideAPlayerIds, ...data.sideBPlayerIds];
      return new Set(all).size === all.length;
    },
    { message: "Гравець не може грати за обидві сторони одночасно", path: ["sideBPlayerIds"] },
  );

export type RubberFormInput = z.infer<typeof rubberFormSchema>;

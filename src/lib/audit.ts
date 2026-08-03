import { prisma } from "@/lib/db";

export const AUDIT_ACTIONS = [
  "match.create",
  "match.update",
  "match.delete",
  "match.score",
  "match.randomize",
  "tournament.create",
  "tournament.update",
  "tournament.delete",
  "tournament.participant.add",
  "tournament.participant.remove",
  "tournament.participant.seed",
  "tournament.participant.group",
  "player.create",
  "player.update",
  "player.delete",
  "player.unlink",
  "player.link",
  "news.create",
  "news.update",
  "news.delete",
  "user.role",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  "match.create": "Матч створено",
  "match.update": "Матч оновлено",
  "match.delete": "Матч видалено",
  "match.score": "Рахунок збережено",
  "match.randomize": "Рандомайзер",
  "tournament.create": "Турнір створено",
  "tournament.update": "Турнір оновлено",
  "tournament.delete": "Турнір видалено",
  "tournament.participant.add": "Учасника додано",
  "tournament.participant.remove": "Учасника видалено",
  "tournament.participant.seed": "Сіяність змінено",
  "tournament.participant.group": "Групу змінено",
  "player.create": "Гравця створено",
  "player.update": "Гравця оновлено",
  "player.delete": "Гравця видалено",
  "player.unlink": "Акаунт відв'язано",
  "player.link": "Акаунт прив'язано",
  "news.create": "Новину створено",
  "news.update": "Новину оновлено",
  "news.delete": "Новину видалено",
  "user.role": "Роль змінено",
};

type Actor = { id: string; name?: string | null; email?: string | null };

/**
 * Records one admin mutation. Best-effort: a logging failure shouldn't take
 * down the mutation it's describing, so errors are swallowed (and printed)
 * rather than propagated - the action that already succeeded still returns
 * normally to the user.
 */
export async function logAudit(
  actor: Actor,
  entry: { action: AuditAction; entityType: string; entityId?: string; summary: string },
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorLabel: actor.name ?? actor.email ?? "Невідомий",
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        summary: entry.summary,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log entry", entry, error);
  }
}

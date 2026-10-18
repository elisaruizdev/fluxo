import type { Prisma } from '../generated/prisma/client.js';

export const cardInclude = { labels: { select: { labelId: true } } } as const satisfies Prisma.CardInclude;

type CardWithLabels = Prisma.CardGetPayload<{ include: typeof cardInclude }>;

/** La tabla intermedia card_labels se aplana a `labelIds`, que es lo que usa el frontend */
export function toCardDto({ labels, ...card }: CardWithLabels) {
  return { ...card, labelIds: labels.map((l) => l.labelId) };
}

export type CardDto = ReturnType<typeof toCardDto>;

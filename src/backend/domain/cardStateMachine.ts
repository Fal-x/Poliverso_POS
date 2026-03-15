import type { CardStatus } from '@prisma/client';

type TransitionMap = Record<CardStatus, CardStatus[]>;

const CARD_TRANSITIONS: TransitionMap = {
  ACTIVE: ['BLOCKED', 'LOST', 'INACTIVE', 'REPLACED'],
  BLOCKED: ['ACTIVE', 'LOST', 'INACTIVE', 'REPLACED'],
  LOST: ['REPLACED', 'INACTIVE'],
  REPLACED: [],
  INACTIVE: [],
};

export function canTransitionCardStatus(from: CardStatus, to: CardStatus) {
  if (from === to) return true;
  return CARD_TRANSITIONS[from].includes(to);
}

export function assertValidCardStatusTransition(from: CardStatus, to: CardStatus) {
  if (!canTransitionCardStatus(from, to)) {
    throw new Error(`Transición inválida de ${from} a ${to}`);
  }
}

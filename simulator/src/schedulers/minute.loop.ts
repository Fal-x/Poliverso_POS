import pino from 'pino';
import type { SimMode } from '../config';

export type MinuteTick = {
  tickIndex: number;
  at: Date;
};

export async function runMinuteLoop(params: {
  mode: SimMode;
  startAt: Date;
  endAt: Date;
  tickMinutes: number;
  x60TickMs: number;
  realtimeTickMs: number;
  logger: pino.Logger;
  onTick: (tick: MinuteTick) => Promise<void>;
}): Promise<void> {
  const { mode, logger } = params;

  if (mode === 'backfill') {
    let tickIndex = 0;
    for (
      let cursor = new Date(params.startAt);
      cursor <= params.endAt;
      cursor = new Date(cursor.getTime() + params.tickMinutes * 60_000)
    ) {
      await params.onTick({ tickIndex, at: new Date(cursor) });
      tickIndex += 1;
    }
    logger.info({ ticks: tickIndex }, 'backfill loop completed');
    return;
  }

  const stepMs = mode === 'x60' ? params.x60TickMs : params.realtimeTickMs;
  let tickIndex = 0;
  const cursor = mode === 'x60' ? new Date(params.startAt) : new Date();

  while (true) {
    if (mode === 'x60' && cursor > params.endAt) {
      break;
    }

    const tickAt = new Date(cursor);
    await params.onTick({ tickIndex, at: tickAt });
    tickIndex += 1;

    await new Promise((resolve) => setTimeout(resolve, stepMs));

    if (mode === 'x60') {
      cursor.setTime(cursor.getTime() + params.tickMinutes * 60_000);
    } else {
      cursor.setTime(Date.now());
    }
  }

  logger.info({ ticks: tickIndex, mode }, 'loop completed');
}

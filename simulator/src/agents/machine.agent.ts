import crypto from 'node:crypto';
import type pino from 'pino';
import type { ApiClient, ReaderAuthContext } from '../api.client';
import type { DbWriter } from '../db.writer';
import type { OccupancySnapshot } from '../models/occupancy.model';

export type MachineReader = {
  id: string;
  code: string;
  siteId: string;
  attractionId: string;
};

export class MachineAgent {
  constructor(
    private readonly api: ApiClient,
    private readonly db: DbWriter,
    private readonly logger: pino.Logger,
  ) {}

  async runMinute(params: {
    siteId: string;
    readers: MachineReader[];
    occupancy: OccupancySnapshot;
    cardUidPool: string[];
    readerAuth: ReaderAuthContext;
    createdByUserId: string;
    now: Date;
    rng: () => number;
  }): Promise<{ usages: number; failures: number }> {
    const { readers, occupancy, cardUidPool } = params;
    if (readers.length === 0 || cardUidPool.length === 0) {
      return { usages: 0, failures: 0 };
    }

    const sessions = Math.min(occupancy.expectedNewSessions, readers.length * 4);
    let usages = 0;
    let failures = 0;

    for (let i = 0; i < sessions; i += 1) {
      const reader = readers[Math.floor(params.rng() * readers.length)]!;
      const uid = cardUidPool[Math.floor(params.rng() * cardUidPool.length)]!;
      const requestId = `SIM-RDR-${crypto.randomUUID()}`;

      const shouldFail = params.rng() < occupancy.machineFailureProbability;
      if (shouldFail) {
        failures += 1;
        await this.db.createDeviceLog({
          siteId: params.siteId,
          readerId: reader.id,
          requestId,
          eventType: 'READER_VALIDATE',
          allowed: false,
          reason: 'RANDOM_READER_FAILURE',
          uid,
          occurredAt: params.now,
        });
        continue;
      }

      const response = await this.api.readerValidate({
        reader: {
          readerCode: reader.code,
          apiToken: params.readerAuth.apiToken,
          hmacSecret: params.readerAuth.hmacSecret,
        },
        uid,
        requestId,
        timestampSec: Math.floor(Date.now() / 1000),
      });

      if (response?.allowed) {
        usages += 1;
      } else {
        failures += 1;
      }
    }

    this.logger.debug({ siteId: params.siteId, usages, failures }, 'machine minute summary');
    return { usages, failures };
  }
}

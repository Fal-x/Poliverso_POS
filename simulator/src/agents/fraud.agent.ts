import type pino from 'pino';
import type { ApiClient } from '../api.client';
import type { SimulatorConfig } from '../config';
import type { DbWriter } from '../db.writer';
import {
  runOffHoursUsage,
  runRepeatedRechargeBurst,
  runSimultaneousCardUse,
  runSuspiciousCashImbalance,
  runVoidBurst,
  type FraudPatternContext,
} from '../anomalies/fraud.patterns';

export class FraudAgent {
  constructor(
    private readonly config: SimulatorConfig,
    private readonly api: ApiClient,
    private readonly db: DbWriter,
    private readonly logger: pino.Logger,
  ) {}

  async maybeRun(params: {
    context: FraudPatternContext;
    rng: () => number;
  }): Promise<void> {
    if (!this.config.fraud.enabled) return;

    const siteCalibration = this.config.siteCalibrations[0];
    const threshold = Math.max(0.0001, siteCalibration.fraudRate);
    if (params.rng() > threshold) return;

    const context = params.context;
    const executions: string[] = [];

    if (this.config.fraud.simultaneousCardUse && params.rng() < 0.45) {
      const hit = await runSimultaneousCardUse({ db: this.db, context });
      executions.push(`simultaneous:${hit}`);
    }

    if (this.config.fraud.repeatedRechargeBurst && params.rng() < 0.4) {
      const burst = await runRepeatedRechargeBurst({
        api: this.api,
        context,
        times: 2 + Math.floor(params.rng() * 4),
        amount: this.config.minRecharge * (1 + params.rng() * 0.8),
      });
      executions.push(`recharge_burst:${burst}`);
    }

    if (this.config.fraud.voidBurst && params.rng() < 0.4) {
      const voided = await runVoidBurst({
        db: this.db,
        context,
        burstSize: 2 + Math.floor(params.rng() * 4),
      });
      executions.push(`void_burst:${voided}`);
    }

    if (this.config.fraud.suspiciousCashImbalance && params.rng() < 0.35) {
      await runSuspiciousCashImbalance({
        db: this.db,
        context,
        amount: 5000 + Math.floor(params.rng() * 80_000),
      });
      executions.push('cash_imbalance:1');
    }

    const hour = context.now.getHours();
    const isOffHours = hour < 9 || hour > 22;
    if (this.config.fraud.offHoursUsage && isOffHours && params.rng() < 0.5) {
      const used = await runOffHoursUsage({ db: this.db, context });
      executions.push(`off_hours:${Number(used)}`);
    }

    if (executions.length > 0) {
      this.logger.warn({ siteId: context.siteId, executions, at: context.now.toISOString() }, 'fraud patterns triggered');
    }
  }
}

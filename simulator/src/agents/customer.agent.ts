import type { DbWriter } from '../db.writer';
import type { CustomerIntent } from '../models/retention.model';

type CustomerAgentState = {
  recurrentCustomerIds: string[];
  heavyCustomerIds: string[];
};

export class CustomerAgent {
  private readonly stateBySite = new Map<string, CustomerAgentState>();

  constructor(private readonly db: DbWriter) {}

  private getState(siteId: string): CustomerAgentState {
    let state = this.stateBySite.get(siteId);
    if (!state) {
      state = { recurrentCustomerIds: [], heavyCustomerIds: [] };
      this.stateBySite.set(siteId, state);
    }
    return state;
  }

  async resolveCustomer(params: {
    siteId: string;
    intent: CustomerIntent;
    rng: () => number;
  }): Promise<{ customerId: string; cardId: string; cardUid: string }> {
    const state = this.getState(params.siteId);

    const chooseFrom =
      params.intent.customerType === 'heavy'
        ? state.heavyCustomerIds
        : params.intent.customerType === 'recurrent'
          ? state.recurrentCustomerIds
          : [];

    let customerId: string | null = null;
    if (chooseFrom.length > 0 && params.rng() < 0.82) {
      customerId = chooseFrom[Math.floor(params.rng() * chooseFrom.length)] ?? null;
    }

    if (!customerId) {
      const customer = await this.db.ensureCustomer({
        siteId: params.siteId,
        rng: params.rng,
        customerType: params.intent.customerType,
      });
      customerId = customer.id;
      state.recurrentCustomerIds.push(customer.id);
      if (params.intent.customerType === 'heavy' || params.rng() < 0.2) {
        state.heavyCustomerIds.push(customer.id);
      }
    }

    const minBalance = params.intent.willRecharge ? 0 : Math.max(2000, Math.round(params.intent.intendedSpend * 0.25));
    const card = await this.db.ensureActiveCard({
      siteId: params.siteId,
      customerId,
      rng: params.rng,
      minBalance,
    });

    return {
      customerId,
      cardId: card.id,
      cardUid: card.uid,
    };
  }
}

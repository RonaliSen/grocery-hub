export type PantryConsumptionActionType = 'increment' | 'decrement' | 'empty';

export interface PantryConsumptionLog {
  readonly id: string;
  readonly itemId: string;
  readonly actionType: PantryConsumptionActionType;
  readonly amount: number;
  readonly previousQuantity: number;
  readonly nextQuantity: number;
  readonly createdAt: string;
}

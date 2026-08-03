export const SHOPPING_FREQUENCY_OPTIONS = ['daily', 'weekly', 'biweekly'] as const;
export type ShoppingFrequency = (typeof SHOPPING_FREQUENCY_OPTIONS)[number];

export const UNIT_PREFERENCE_OPTIONS = ['mixed', 'metric', 'imperial'] as const;
export type UnitPreference = (typeof UNIT_PREFERENCE_OPTIONS)[number];

export interface UserProfile {
  readonly fullName: string;
  readonly age: number | null;
  readonly email: string;
  readonly householdSize: number | null;
  readonly photoDataUrl: string | null;
  readonly preferredShoppingFrequency: ShoppingFrequency;
  readonly defaultUnitPreference: UnitPreference;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  fullName: '',
  age: null,
  email: '',
  householdSize: null,
  photoDataUrl: null,
  preferredShoppingFrequency: 'weekly',
  defaultUnitPreference: 'mixed'
};

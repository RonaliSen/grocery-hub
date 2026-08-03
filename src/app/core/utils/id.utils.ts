export function createId(prefix = 'id'): string {
  const randomValue = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomValue}`;
}

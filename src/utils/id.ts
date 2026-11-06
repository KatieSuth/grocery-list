import { randomToken } from 'rxdb';

export function createId(): string {
  return randomToken(16);
}

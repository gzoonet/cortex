import type { PrivacyLevel } from './types/config.js';

export const PRIVACY_LEVELS: readonly PrivacyLevel[] = ['standard', 'sensitive', 'restricted'];

export function isPrivacyLevel(value: unknown): value is PrivacyLevel {
  return typeof value === 'string' && (PRIVACY_LEVELS as readonly string[]).includes(value);
}

/**
 * Fail-closed privacy normalization. Anything that is not exactly a known level
 * (a typo, different casing, a missing project) is treated as `restricted`, so
 * malformed data can never widen what is sent to a cloud provider.
 */
export function normalizePrivacyLevel(value: unknown): PrivacyLevel {
  return isPrivacyLevel(value) ? value : 'restricted';
}

/** The stricter of two levels: restricted > sensitive > standard. */
export function stricterPrivacyLevel(a: PrivacyLevel, b: PrivacyLevel): PrivacyLevel {
  return PRIVACY_LEVELS.indexOf(a) >= PRIVACY_LEVELS.indexOf(b) ? a : b;
}

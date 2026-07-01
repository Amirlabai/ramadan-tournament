import { describe, expect, it } from 'vitest';
import { registrationStatusNeedsIdentitySubmission } from './registrationStatus';

describe('registrationStatusNeedsIdentitySubmission', () => {
  it('returns true when status is missing or none', () => {
    expect(registrationStatusNeedsIdentitySubmission(undefined)).toBe(true);
    expect(registrationStatusNeedsIdentitySubmission(null)).toBe(true);
    expect(registrationStatusNeedsIdentitySubmission('none')).toBe(true);
  });

  it('returns false once identity has been submitted or registration is active', () => {
    expect(registrationStatusNeedsIdentitySubmission('awaiting_identity')).toBe(false);
    expect(registrationStatusNeedsIdentitySubmission('identity_assigned')).toBe(false);
    expect(registrationStatusNeedsIdentitySubmission('active')).toBe(false);
    expect(registrationStatusNeedsIdentitySubmission('join_pending')).toBe(false);
    expect(registrationStatusNeedsIdentitySubmission('archived')).toBe(false);
  });
});

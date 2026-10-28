import { describe, expect, it } from 'vitest';
import { menuRoleLabel } from './roleLabel';

describe('menuRoleLabel', () => {
  it('uses the saved role name instead of the role id', () => {
    expect(
      menuRoleLabel({
        roleName: 'Test Salesperson',
        isAdmin: false,
        isSalesManager: false,
      }),
    ).toBe('Test Salesperson');
  });
});

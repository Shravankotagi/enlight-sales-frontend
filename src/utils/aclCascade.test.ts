import { describe, expect, it } from 'vitest';
import { cascadeCrudPermission } from './aclConstants';

describe('cascadeCrudPermission', () => {
  const blank = {
    'customers.view': false,
    'customers.create': false,
    'customers.edit': false,
    'customers.delete': false,
    'customers.reassign': true,
  };

  it('turns on the weaker boxes and clears stronger ones', () => {
    expect(cascadeCrudPermission(blank, 'customers.create', true)).toMatchObject({
      'customers.view': true,
      'customers.create': true,
      'customers.edit': false,
      'customers.delete': false,
    });
    expect(cascadeCrudPermission(blank, 'customers.edit', true)).toMatchObject({
      'customers.view': true,
      'customers.create': true,
      'customers.edit': true,
    });
    expect(cascadeCrudPermission(blank, 'customers.delete', true)).toMatchObject({
      'customers.view': true,
      'customers.create': true,
      'customers.edit': true,
      'customers.delete': true,
    });

    const full = cascadeCrudPermission(blank, 'customers.delete', true);
    expect(cascadeCrudPermission(full, 'customers.view', false)).toMatchObject({
      'customers.view': false,
      'customers.create': false,
      'customers.edit': false,
      'customers.delete': false,
    });
    expect(cascadeCrudPermission(full, 'customers.create', false)).toMatchObject({
      'customers.view': true,
      'customers.create': false,
      'customers.edit': false,
      'customers.delete': false,
    });
    expect(cascadeCrudPermission(full, 'customers.reassign', false)['customers.delete']).toBe(
      true,
    );
  });
});
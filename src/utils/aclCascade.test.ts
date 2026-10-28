import { describe, expect, it } from 'vitest';
import { cascadeCrudPermission, routeAllowed } from './aclConstants';

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

  it('ties bulk csv import to staff view', () => {
    const staff = {
      'staff.view': true,
      'staff.create': true,
      'clients.import_csv': true,
    };
    expect(cascadeCrudPermission(staff, 'staff.view', false)).toMatchObject({
      'staff.view': false,
      'staff.create': false,
      'clients.import_csv': false,
    });
    expect(
      cascadeCrudPermission({ 'staff.view': false, 'clients.import_csv': false }, 'clients.import_csv', true),
    ).toMatchObject({
      'staff.view': true,
      'clients.import_csv': true,
    });
  });

  it('keeps intelligence and reports behind a view permission', () => {
    const customerOnly = (key: string) => key === 'customers.view';
    expect(routeAllowed('/intelligence', customerOnly)).toBe(true);
    expect(routeAllowed('/reports', customerOnly)).toBe(true);
    expect(routeAllowed('/intelligence', () => false)).toBe(false);
    expect(routeAllowed('/reports', () => false)).toBe(false);
  });
});
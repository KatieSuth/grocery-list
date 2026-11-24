import {
  addDepartment,
  addDepartmentFromStores,
  addPendingDepartment,
  copyDepartments,
  moveDepartment,
  removeDepartment,
  sortDepartmentsByName,
} from '@/domain/departments';

const depts = [
  { id: 'a', name: 'Produce' },
  { id: 'b', name: 'Deli' },
  { id: 'c', name: 'Frozen' },
];
const names = (list: { name: string }[]) => list.map((d) => d.name);

describe('addDepartment', () => {
  test('appends a normalized name', () => {
    const result = addDepartment(depts, '  Dairy   case ');
    expect(result.ok && names(result.departments)).toEqual(['Produce', 'Deli', 'Frozen', 'Dairy case']);
  });

  test('rejects blank names', () => {
    expect(addDepartment(depts, '  ')).toEqual({ ok: false, error: 'Enter a department name.' });
  });

  test('rejects duplicates regardless of case', () => {
    expect(addDepartment(depts, 'deli')).toEqual({ ok: false, error: '"deli" is already in the list.' });
  });
});

test('removeDepartment removes by id', () => {
  expect(names(removeDepartment(depts, 'b'))).toEqual(['Produce', 'Frozen']);
});

describe('moveDepartment', () => {
  test('moves up and down', () => {
    expect(names(moveDepartment(depts, 2, -1))).toEqual(['Produce', 'Frozen', 'Deli']);
    expect(names(moveDepartment(depts, 0, 1))).toEqual(['Deli', 'Produce', 'Frozen']);
  });

  test('does not mutate the input', () => {
    moveDepartment(depts, 0, 1);
    expect(names(depts)).toEqual(['Produce', 'Deli', 'Frozen']);
  });

  test.each([
    [0, -1],
    [2, 1],
    [-1, 1],
    [5, -1],
  ] as const)('index %i direction %i is a no-op', (index, direction) => {
    expect(moveDepartment(depts, index, direction)).toBe(depts);
  });
});

describe('sortDepartmentsByName', () => {
  test('sorts A–Z ignoring case and accents, without mutating the input', () => {
    const mixed = [...depts, { id: 'd', name: 'bakery' }, { id: 'e', name: 'Épicerie' }, { id: 'f', name: 'Dairy' }];
    expect(names(sortDepartmentsByName(mixed))).toEqual(['bakery', 'Dairy', 'Deli', 'Épicerie', 'Frozen', 'Produce']);
    expect(names(depts)).toEqual(['Produce', 'Deli', 'Frozen']);
  });
});

describe('copyDepartments', () => {
  test('appends new names in source order, skipping ones already listed', () => {
    const source = [
      { id: 'x', name: 'Bakery' },
      { id: 'y', name: '  deli ' },
      { id: 'z', name: 'Bulk   Bins' },
      { id: 'w', name: 'bakery' },
      { id: 'v', name: '   ' },
    ];
    const result = copyDepartments(depts, source);
    expect(result.added).toEqual(['Bakery', 'Bulk Bins']);
    expect(names(result.departments)).toEqual(['Produce', 'Deli', 'Frozen', 'Bakery', 'Bulk Bins']);
    // Existing departments keep their ids; copies get new ones.
    expect(result.departments.slice(0, 3)).toEqual(depts);
    const newIds = result.departments.slice(3).map((d) => d.id);
    expect(newIds).not.toContain('x');
    expect(newIds).not.toContain('z');
    expect(new Set(result.departments.map((d) => d.id)).size).toBe(5);
    expect(names(depts)).toEqual(['Produce', 'Deli', 'Frozen']);
  });

  test('adds nothing when every name is already listed', () => {
    const result = copyDepartments(depts, [{ id: 'x', name: 'FROZEN' }]);
    expect(result).toEqual({ departments: depts, added: [] });
  });
});

test('department names follow the shared name rules', () => {
  expect(addDepartment([], 'Deli\u0007')).toEqual({
    ok: false,
    error: 'Department name contains hidden or control characters, which aren’t allowed.',
  });
  expect(addDepartment([], 'x'.repeat(101))).toEqual({ ok: false, error: 'Department name is longer than 100 characters.' });
});

describe('adding a typed name', () => {
  const stores = [{ id: 's', name: 'Corner Market', departments: [{ id: 'x', name: 'Frozen Foods' }], createdAt: 1 }];

  test('reuses the spelling from another store', () => {
    const result = addDepartmentFromStores([], ' frozen   foods ', stores);
    expect(result).toEqual({ ok: true, departments: [{ id: expect.any(String), name: 'Frozen Foods' }] });
    expect(addDepartmentFromStores([], 'Bakery', stores)).toMatchObject({ ok: true, departments: [{ name: 'Bakery' }] });
  });

  test('when saving, a name still being typed is added; blank or already listed changes nothing', () => {
    const departments = [{ id: 'd', name: 'Deli' }];
    expect(addPendingDepartment(departments, 'frozen foods', stores)).toMatchObject({
      ok: true,
      departments: [{ name: 'Deli' }, { name: 'Frozen Foods' }],
    });
    expect(addPendingDepartment(departments, ' ', stores)).toEqual({ ok: true, departments });
    expect(addPendingDepartment(departments, 'DELI', stores)).toEqual({ ok: true, departments });
    expect(addPendingDepartment(departments, 'Deli\u202E2', stores)).toMatchObject({ ok: false });
  });
});

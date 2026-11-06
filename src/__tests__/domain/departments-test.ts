import {
  addDepartment,
  createDefaultDepartments,
  DEFAULT_DEPARTMENT_NAMES,
  moveDepartment,
  removeDepartment,
} from '@/domain/departments';

const depts = [
  { id: 'a', name: 'Produce' },
  { id: 'b', name: 'Deli' },
  { id: 'c', name: 'Frozen' },
];
const names = (list: { name: string }[]) => list.map((d) => d.name);

test('defaults are Produce, Deli, Frozen with unique ids', () => {
  const defaults = createDefaultDepartments();
  expect(names(defaults)).toEqual([...DEFAULT_DEPARTMENT_NAMES]);
  expect(new Set(defaults.map((d) => d.id)).size).toBe(3);
  // Fresh ids each time, so stores never share department ids.
  expect(createDefaultDepartments()[0].id).not.toBe(defaults[0].id);
});

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

import { act, type ReactNode } from 'react';

import { DateField, fromInputValue, toInputValue } from '@/components/date-field.web';

// The project has no react-dom types; only these two calls are needed.
const { createRoot } = jest.requireActual('react-dom/client') as {
  createRoot: (el: Element) => { render: (node: ReactNode) => void; unmount: () => void };
};

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date).getTime();

test('date input values convert to and from local days', () => {
  expect(toInputValue(day(2026, 3, 8))).toBe('2026-03-08');
  expect(fromInputValue('2026-03-08')).toBe(day(2026, 3, 8));
  expect(fromInputValue('')).toBeUndefined();
  expect(fromInputValue('2026-02-30')).toBeUndefined();
});

/** Renders a field and returns its input and the days it reported. */
async function renderField(min?: number) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const chosen: number[] = [];
  await act(async () =>
    root.render(
      <DateField label="To" value={day(2026, 11, 1)} min={min} max={day(2026, 11, 23)} onChange={(d) => chosen.push(d)} />,
    ),
  );
  const input = container.querySelector('input') as HTMLInputElement;
  /** Types a value the way React sees a browser change. */
  const enter = async (value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    await act(async () => input.dispatchEvent(new Event('input', { bubbles: true })));
  };
  const done = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { input, chosen, enter, done };
}

test('on web, a labeled date input limited to the allowed days', async () => {
  const field = await renderField(day(2026, 10, 1));
  expect(field.input.type).toBe('date');
  expect(field.input.getAttribute('aria-label')).toBe('To');
  expect(field.input.value).toBe('2026-11-01');
  expect(field.input.min).toBe('2026-10-01');
  expect(field.input.max).toBe('2026-11-23');

  await field.enter('2026-11-05');
  // Outside the allowed days, or cleared: ignored.
  await field.enter('2026-11-24');
  await field.enter('2026-09-30');
  await field.enter('');
  expect(field.chosen).toEqual([day(2026, 11, 5)]);
  await field.done();
});

test('with no earliest day, any day up to the latest can be chosen', async () => {
  const field = await renderField();
  expect(field.input.hasAttribute('min')).toBe(false);
  await field.enter('2001-01-01');
  expect(field.chosen).toEqual([day(2001, 1, 1)]);
  await field.done();
});

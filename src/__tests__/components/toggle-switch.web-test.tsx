import { act, type ReactNode } from 'react';

import { THUMB_COLOR, ToggleSwitch } from '@/components/toggle-switch.web';
import { Colors } from '@/constants/theme';

// The project has no react-dom types; only these two calls are needed.
const { createRoot } = jest.requireActual('react-dom/client') as {
  createRoot: (el: Element) => { render: (node: ReactNode) => void; unmount: () => void };
};

/** Renders the switch into the page and returns the background colors of its track and thumb. */
async function colors(value: boolean) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<ToggleSwitch accessibilityLabel="Reverse order" value={value} />));
  const [track, thumb] = [...container.querySelectorAll('div')]
    .map((el) => getComputedStyle(el).backgroundColor)
    .filter((color) => color && color !== 'rgba(0, 0, 0, 0)');
  await act(async () => root.unmount());
  container.remove();
  return { track, thumb };
}

const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

test('on web, the track shows in both states and the thumb stays white, like iOS', async () => {
  expect(await colors(false)).toEqual({ track: rgb(Colors.light.switchTrackOff), thumb: rgb(THUMB_COLOR) });
  expect(await colors(true)).toEqual({ track: rgb(Colors.light.tint), thumb: rgb(THUMB_COLOR) });
});

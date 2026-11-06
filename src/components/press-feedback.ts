/** Opacity for a pressable: dimmed when disabled, slightly faded while pressed. */
export function pressOpacity(pressed: boolean, disabled?: boolean | null): number {
  if (disabled) return 0.4;
  return pressed ? 0.7 : 1;
}

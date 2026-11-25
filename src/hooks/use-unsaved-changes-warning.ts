import { usePreventRemove, type Href } from 'expo-router';
import { useState } from 'react';

import { confirmDestructive } from '@/utils/confirm';
import { goBack } from '@/utils/navigation';

/**
 * Asks before a form with unsaved changes is closed, however it's closed: Cancel, the header's
 * back button, a back swipe or Android's back button. Leaving discards the changes, so a form is
 * never kept open in the background with stale data.
 *
 * `what` names the thing being edited, e.g. "store". While `busy` (a save is being written), the
 * form can't be left at all, so the save isn't cut short or left to finish unseen. Returns
 * `leave`, which closes the form without asking: for after it has been saved or deleted.
 *
 * `onLeaveAttempt`, when given, is called instead of asking: for a step within the form (e.g.
 * reassigning items) where Back means going back to the form, not leaving it.
 */
export function useUnsavedChangesWarning(
  unsaved: boolean,
  what: string,
  busy = false,
  onLeaveAttempt?: () => void,
): (backTo: Href) => void {
  const [leaving, setLeaving] = useState(false);
  const disablePrevention = usePreventRemove((unsaved || busy || !!onLeaveAttempt) && !leaving, ({ repeat }) => {
    if (busy) return;
    if (onLeaveAttempt) {
      onLeaveAttempt();
      return;
    }
    confirmDestructive({
      title: 'Leave without saving?',
      message: `This ${what} hasn’t been saved. If you leave now, your changes will be lost.`,
      confirmLabel: 'Leave',
      cancelLabel: 'Keep editing',
      onConfirm: () => {
        setLeaving(true);
        repeat();
      },
    });
  });

  return (backTo) => {
    setLeaving(true);
    disablePrevention();
    goBack(backTo);
  };
}

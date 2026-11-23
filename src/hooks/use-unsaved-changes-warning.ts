import { usePreventRemove, type Href } from 'expo-router';
import { useState } from 'react';

import { confirmDestructive } from '@/utils/confirm';
import { goBack } from '@/utils/navigation';

/**
 * Asks before a form with unsaved changes is closed, however it's closed: Cancel, the header's
 * back button, a back swipe or Android's back button. Leaving discards the changes, so a form is
 * never kept open in the background with stale data.
 *
 * `what` names the thing being edited, e.g. "store". Returns `leave`, which closes the form
 * without asking: for after it has been saved or deleted.
 */
export function useUnsavedChangesWarning(unsaved: boolean, what: string): (backTo: Href) => void {
  const [leaving, setLeaving] = useState(false);
  const disablePrevention = usePreventRemove(unsaved && !leaving, ({ repeat }) => {
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

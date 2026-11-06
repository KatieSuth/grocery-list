import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

/** Placeholder until the shopping trip is designed. */
export default function TripScreen() {
  return (
    <Screen>
      <EmptyState title="Shopping trips are coming soon" message="For now, check off what you need on the Items tab." />
    </Screen>
  );
}

// Shared provider-queue predicates. Kept out of the component files so importing
// them doesn't trip the react-refresh "components-only export" rule.

import type { AssessmentListItem } from '../types/drp';

export function hasHighFlag(a: AssessmentListItem): boolean {
  return a.flags.some((f) => f.severity === 'HIGH');
}

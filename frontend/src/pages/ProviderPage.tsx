// Provider surface (Derrick's lane). Stub so the route + shell resolve; Derrick
// builds the review queue w/ red-flag filter, certify/refer actions, and the
// policy assistant here.
export default function ProviderPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold">Provider Review Queue</h1>
      <p className="mt-2 text-sm text-muted">
        Provider surface — owned by Derrick. Reusable primitives (DataTable,
        StatusBadge, SeverityBadge) and the API client are ready. See{' '}
        <span className="font-mono">team/frontend-derrick.md</span>.
      </p>
    </div>
  );
}

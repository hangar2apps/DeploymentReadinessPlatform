// Service-member surface (Derrick's lane). Stub so the route + shell resolve;
// Derrick builds the questionnaire (incl. PHQ-9) + doc upload here.
export default function AssessmentPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Deployment Health Assessment</h1>
      <p className="mt-2 text-sm text-muted">
        Service-member questionnaire surface — owned by Derrick. The app shell,
        role switcher, design system, and API client (mock mode on) are ready to
        build against. See <span className="font-mono">team/frontend-derrick.md</span>.
      </p>
    </div>
  );
}

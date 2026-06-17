// Controlled Unclassified Information banner. Required across the top of every
// surface (frontend-bryan.md §1). This is a demo — explicitly NOT real PHI.
export function CuiBar() {
  return (
    <div className="bg-accent text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-bg">
      CUI // CONTROLLED UNCLASSIFIED INFORMATION // DEMO — NOT ACTUAL PHI
    </div>
  );
}

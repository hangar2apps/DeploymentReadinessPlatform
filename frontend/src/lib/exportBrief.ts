// Client-side CUB brief export (DRP_SPEC §5 SHOULD; PDF is frontend per
// TEAM_PLAN). Builds a text-based PDF from dashboard data with jsPDF — no server
// round-trip, no html2canvas (keeps it crisp + selectable).

import { jsPDF } from 'jspdf';
import type {
  ReadinessRollup,
  RedFlagSummaryItem,
} from '../types/drp';

interface BriefInput {
  unitName: string;
  generatedAt: Date;
  readiness: ReadinessRollup;
  redFlags: RedFlagSummaryItem[];
}

export function exportCubBrief({
  unitName,
  generatedAt,
  readiness,
  redFlags,
}: BriefInput) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

  // jsPDF doesn't auto-paginate; break to a new page before y runs off the
  // bottom so long company/flag lists don't overflow.
  const ensureSpace = (needed: number) => {
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
    }
  };

  // CUI banner
  doc.setFillColor(197, 214, 74);
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(14, 22, 19);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(
    'CUI // CONTROLLED UNCLASSIFIED INFORMATION // DEMO — NOT ACTUAL PHI',
    W / 2,
    14,
    { align: 'center' },
  );
  let y = 56;

  // Title
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Commander Update Brief — Readiness', M, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(unitName, M, y);
  y += 14;
  doc.text(`Generated ${generatedAt.toLocaleString()}`, M, y);
  y += 28;

  // Headline KPIs
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Medical Readiness', M, y);
  y += 18;
  doc.setFont('courier', 'normal');
  doc.setFontSize(11);
  const kpis: [string, string][] = [
    ['% Deployable', `${readiness.pct_deployable.toFixed(1)}%  (${readiness.deployable_count}/${readiness.total_assigned})`],
    ['Δ vs last week', `${readiness.delta_from_last_week >= 0 ? '+' : ''}${readiness.delta_from_last_week.toFixed(1)}%`],
    ['Non-deployable', `${readiness.non_deployable_count}`],
    ['PDHRA compliance', `${readiness.pdhra_compliance_pct.toFixed(0)}%`],
  ];
  for (const [k, v] of kpis) {
    doc.setTextColor(90, 90, 90);
    doc.text(k.padEnd(20), M, y);
    doc.setTextColor(20, 20, 20);
    doc.text(v, M + 150, y);
    y += 16;
  }
  y += 14;

  // By company
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Readiness by Company', M, y);
  y += 18;
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  for (const c of readiness.by_company) {
    ensureSpace(15);
    doc.setTextColor(90, 90, 90);
    doc.text(c.short_name.padEnd(8), M, y);
    doc.setTextColor(20, 20, 20);
    doc.text(`${c.deployable}/${c.assigned}`, M + 80, y);
    doc.text(`${c.pct.toFixed(1)}%`, M + 150, y);
    y += 15;
  }
  y += 18;

  // Attention required
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Attention Required', M, y);
  y += 18;
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  for (const f of redFlags) {
    ensureSpace(28);
    doc.setTextColor(20, 20, 20);
    doc.text(`${String(f.soldier_count).padStart(2)}  ${f.category}`, M, y);
    doc.setTextColor(90, 90, 90);
    doc.text(`[${f.severity}] ${f.units.join(', ')}`, M + 16, y + 12);
    y += 28;
  }

  doc.save(`CUB_Brief_${generatedAt.toISOString().slice(0, 10)}.pdf`);
}

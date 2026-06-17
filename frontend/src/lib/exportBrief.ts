// Client-side PDF exports (DRP_SPEC §5 SHOULD; PDF is frontend per TEAM_PLAN).
// Two documents, both text-based jsPDF (crisp, selectable, no html2canvas):
//   - exportCubBrief:   executive Commander's Update Brief (for higher HQ)
//   - exportActionList: 1SG non-deployable work-list (internal taskings)
// Both are light/white for print, CUI-banded top and bottom on every page.

import { jsPDF } from 'jspdf';
import type {
  CompanyReadiness,
  DeployableReason,
  ReadinessRollup,
  RedFlagSummaryItem,
  ServiceMember,
} from '../types/drp';

type RGB = [number, number, number];

const ACCENT: RGB = [197, 214, 74];
const INK: RGB = [24, 28, 26];
const SUBTLE: RGB = [110, 116, 112];
const LINE: RGB = [212, 216, 210];
const OK: RGB = [22, 143, 68];
const WARN: RGB = [194, 132, 8];
const DANGER: RGB = [200, 50, 50];

const M = 48; // content margin

function pctColor(pct: number): RGB {
  if (pct > 90) return OK;
  if (pct >= 80) return WARN;
  return DANGER;
}

function dateStamp(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// CUI bands (top + bottom) and footer on every page. Run last so it covers all
// pages added during layout. Content stays inside [34, H-36] to avoid the bands.
function decorate(doc: jsPDF, footerLeft: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, W, 18, 'F');
    doc.rect(0, H - 18, W, 18, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(20, 20, 20);
    doc.text(
      'CUI // CONTROLLED UNCLASSIFIED INFORMATION // DEMO — NOT ACTUAL PHI',
      W / 2,
      12,
      { align: 'center' },
    );
    doc.text('CUI // DEMO — NOT ACTUAL PHI', W / 2, H - 6, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(footerLeft, M, H - 24);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: 'right' });
  }
}

// Coarse non-deployable drivers for the BLUF, from the HIGH-severity flag
// summary: "dental (6), behavioral health (4), pregnancy (2)".
function topDrivers(redFlags: RedFlagSummaryItem[]): string {
  const buckets = new Map<string, number>();
  for (const f of redFlags) {
    if (f.severity !== 'HIGH') continue;
    const c = f.category.toLowerCase();
    const key = c.includes('dental')
      ? 'dental'
      : c.includes('behavioral') || c.includes('phq')
        ? 'behavioral health'
        : c.includes('pregnan')
          ? 'pregnancy'
          : c.includes('immuniz')
            ? 'immunizations'
            : c.includes('pha')
              ? 'PHA'
              : 'other';
    buckets.set(key, (buckets.get(key) ?? 0) + f.soldier_count);
  }
  return (
    [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, n]) => `${k} (${n})`)
      .join(', ') || 'none'
  );
}

// ---- Commander's Update Brief ----------------------------------------------

export function exportCubBrief({
  unitName,
  generatedAt,
  readiness,
  redFlags,
}: {
  unitName: string;
  generatedAt: Date;
  readiness: ReadinessRollup;
  redFlags: RedFlagSummaryItem[];
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const TOP = 34;
  const BOTTOM = H - 36;
  let y = TOP + 8;

  const ensure = (need: number) => {
    if (y + need > BOTTOM) {
      doc.addPage();
      y = TOP + 8;
    }
  };
  const heading = (t: string) => {
    ensure(30);
    const label = t.toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(label, M, y);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.5);
    doc.line(M, y + 4, M + doc.getTextWidth(label), y + 4);
    y += 20;
  };

  // Title block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("Commander's Update Brief", M, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...SUBTLE);
  doc.text('Medical Deployment Readiness', M, y);
  y += 15;
  doc.setFontSize(9);
  doc.text(unitName, M, y);
  doc.text(dateStamp(generatedAt), W - M, y, { align: 'right' });
  y += 14;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 18;

  // BLUF box
  const lowest = [...readiness.by_company].sort((a, b) => a.pct - b.pct)[0];
  const deltaWord = readiness.delta_from_last_week >= 0 ? 'up' : 'down';
  const bluf =
    `${unitName} is ${readiness.pct_deployable.toFixed(1)}% medically deployable ` +
    `(${readiness.deployable_count}/${readiness.total_assigned}), ${deltaWord} ` +
    `${Math.abs(readiness.delta_from_last_week).toFixed(1)}% from last week. ` +
    `${lowest.short_name} is the readiness outlier at ${lowest.pct.toFixed(1)}%. ` +
    `Primary non-deployable drivers: ${topDrivers(redFlags)}. ` +
    `PDHRA compliance ${readiness.pdhra_compliance_pct.toFixed(0)}%.`;
  const blufLines = doc.splitTextToSize(bluf, W - 2 * M - 16) as string[];
  const boxH = 22 + blufLines.length * 12;
  ensure(boxH + 8);
  doc.setFillColor(246, 248, 240);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.rect(M, y, W - 2 * M, boxH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text('BOTTOM LINE', M + 8, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(blufLines, M + 8, y + 28);
  y += boxH + 20;

  // KPI cells
  heading('Readiness Snapshot');
  const cells: { label: string; value: string; color: RGB }[] = [
    {
      label: '% Deployable',
      value: `${readiness.pct_deployable.toFixed(1)}%`,
      color: pctColor(readiness.pct_deployable),
    },
    {
      label: 'Non-Deployable',
      value: `${readiness.non_deployable_count}`,
      color: DANGER,
    },
    {
      label: 'PDHRA',
      value: `${readiness.pdhra_compliance_pct.toFixed(0)}%`,
      color: pctColor(readiness.pdhra_compliance_pct),
    },
    {
      label: 'vs Last Week',
      value: `${readiness.delta_from_last_week >= 0 ? '+' : ''}${readiness.delta_from_last_week.toFixed(1)}%`,
      color: readiness.delta_from_last_week >= 0 ? OK : DANGER,
    },
  ];
  const gap = 10;
  const cw = (W - 2 * M - gap * 3) / 4;
  const ch = 50;
  ensure(ch + 10);
  cells.forEach((c, i) => {
    const x = M + i * (cw + gap);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.8);
    doc.setFillColor(250, 250, 247);
    doc.rect(x, y, cw, ch, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SUBTLE);
    doc.text(c.label.toUpperCase(), x + 8, y + 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(...c.color);
    doc.text(c.value, x + 8, y + 38);
  });
  y += ch + 22;

  // Readiness by company (bars)
  heading('Readiness by Company');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...SUBTLE);
  doc.text('COMPANY', M, y);
  doc.text('DEPLOYABLE', M + 96, y);
  y += 5;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 13;
  readiness.by_company.forEach((c) => {
    ensure(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(c.short_name, M, y);
    doc.text(`${c.deployable}/${c.assigned}`, M + 96, y);
    const barX = M + 190;
    const barW = W - M - barX - 46;
    const barY = y - 8;
    doc.setFillColor(233, 235, 230);
    doc.rect(barX, barY, barW, 8, 'F');
    doc.setFillColor(...pctColor(c.pct));
    doc.rect(barX, barY, (barW * c.pct) / 100, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...pctColor(c.pct));
    doc.text(`${c.pct.toFixed(1)}%`, W - M, y, { align: 'right' });
    y += 18;
  });
  y += 10;

  // Attention required
  heading('Attention Required');
  redFlags.forEach((f) => {
    ensure(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(String(f.soldier_count), M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(f.category, M + 22, y);
    doc.setFontSize(8);
    doc.setTextColor(...SUBTLE);
    doc.text(`${f.units.join(', ')}`, W - M, y, {
      align: 'right',
    });
    y += 16;
  });
  y += 10;

  decorate(doc, `Commander's Update Brief · ${unitName}`);
  doc.save(`CUB_Brief_${dateStamp(generatedAt)}.pdf`);
}

// ---- 1SG Non-Deployable Action List ----------------------------------------

const ACTIONS: Record<NonNullable<DeployableReason>, string> = {
  Dental: 'Schedule dental exam; resolve to Class 1/2. Confirm appointment date.',
  'Behavioral Health':
    'Confirm behavioral health referral appointment; track to disposition.',
  Pregnancy: 'Profile per AR 40-501; status confirmed. No action to deploy.',
  Immunizations: 'Complete required immunizations at medical; update record.',
  PHA: 'Schedule Periodic Health Assessment; bring records current.',
};

function actionFor(reason: DeployableReason): string {
  if (reason && reason in ACTIONS) return ACTIONS[reason];
  return 'Review with medical provider; determine path to deployable.';
}

export function exportActionList({
  unitName,
  generatedAt,
  members,
  companies,
  daysToLad,
}: {
  unitName: string;
  generatedAt: Date;
  members: ServiceMember[];
  companies: CompanyReadiness[];
  daysToLad?: number;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const TOP = 34;
  const BOTTOM = H - 36;
  let y = TOP + 8;

  const ensure = (need: number) => {
    if (y + need > BOTTOM) {
      doc.addPage();
      y = TOP + 8;
    }
  };

  const shortName = new Map(companies.map((c) => [c.unit_id, c.short_name]));
  const colName = M + 44;
  const colCat = M + 196;
  const colAction = M + 300;
  const actionWidth = W - M - colAction;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text('Non-Deployable Roster — Action Required', M, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  doc.text(unitName, M, y);
  doc.text(dateStamp(generatedAt), W - M, y, { align: 'right' });
  y += 14;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 16;

  // BLUF
  const ladStr =
    daysToLad != null
      ? ` before the latest arrival date (${daysToLad} days out)`
      : '';
  const bluf = `${members.length} soldiers are non-deployable and require action${ladStr}.`;
  const blufLines = doc.splitTextToSize(bluf, W - 2 * M) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(blufLines, M, y);
  y += blufLines.length * 16 + 14;

  // Group by company, in dashboard order
  const byUnit = new Map<string, ServiceMember[]>();
  for (const m of members) {
    const list = byUnit.get(m.unit_id) ?? [];
    list.push(m);
    byUnit.set(m.unit_id, list);
  }

  for (const c of companies) {
    const list = byUnit.get(c.unit_id);
    if (!list || list.length === 0) continue;

    ensure(46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(shortName.get(c.unit_id) ?? c.short_name, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...SUBTLE);
    doc.text(`${list.length} non-deployable`, W - M, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1);
    doc.line(M, y, W - M, y);
    y += 13;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SUBTLE);
    doc.text('RANK', M, y);
    doc.text('NAME', colName, y);
    doc.text('CATEGORY', colCat, y);
    doc.text('RECOMMENDED ACTION', colAction, y);
    y += 5;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);

    for (const m of list) {
      const actionLines = doc.splitTextToSize(
        actionFor(m.deployable_reason),
        actionWidth,
      ) as string[];
      const lines = Math.max(1, actionLines.length);
      ensure(lines * 11 + 20);
      const rowY = y + 11; // top padding before first baseline
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(m.rank, M, rowY);
      doc.text(
        `${m.last_name}, ${m.first_name} ${m.middle_initial ?? ''}`.trim(),
        colName,
        rowY,
      );
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...DANGER);
      doc.text((m.deployable_reason ?? '—').toUpperCase(), colCat, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(actionLines, colAction, rowY);
      y = rowY + (lines - 1) * 11 + 10; // bottom padding after last line
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.4);
      doc.line(M, y, W - M, y);
    }
    y += 14;
  }

  decorate(doc, 'For Official Use — internal taskings only');
  doc.save(`Action_List_${dateStamp(generatedAt)}.pdf`);
}

export type BarChartModel = {
  title: string;
  labels: string[];
  values: number[];
};

export function escapeXmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncateLabel(label: string, max = 22): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Sloupcový graf jako SVG (stejná data jako UI); PNG vznikne přes sharp v chart-png.ts.
 */
export function buildBarChartSvg(chart: BarChartModel): string {
  const W = 880;
  const H = 440;
  const padL = 56;
  const padR = 28;
  const padT = 56;
  const padB = 80;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = chart.labels.length;
  const maxV = Math.max(...chart.values, 1);

  const title = escapeXmlText(chart.title);
  const noData =
    n === 0
      ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="15" fill="#64748b" font-family="ui-sans-serif, system-ui, sans-serif">Žádná data pro graf.</text>`
      : "";

  const barGapRatio = 0.14;
  const slotW = n > 0 ? plotW / n : 1;
  const barW = n > 0 ? slotW * (1 - barGapRatio) : 0;

  let bars = "";
  for (let i = 0; i < n; i++) {
    const v = chart.values[i] ?? 0;
    const h = (v / maxV) * plotH;
    const x = padL + i * slotW + (slotW - barW) / 2;
    const y = padT + plotH - h;
    const cx = padL + i * slotW + slotW / 2;
    const lbl = escapeXmlText(truncateLabel(chart.labels[i] ?? ""));

    bars += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(h, 2).toFixed(2)}" rx="4" fill="#3b82f6"/>`;
    bars += `<text x="${cx}" y="${(y - 8).toFixed(2)}" text-anchor="middle" font-size="13" font-weight="600" fill="#0f172a" font-family="ui-sans-serif, system-ui, sans-serif">${v}</text>`;
    bars += `<text x="${cx}" y="${H - 36}" text-anchor="middle" font-size="11" fill="#475569" font-family="ui-sans-serif, system-ui, sans-serif">${lbl}</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="36" text-anchor="middle" font-size="18" font-weight="600" fill="#0f172a" font-family="ui-sans-serif, system-ui, sans-serif">${title}</text>
  ${noData}
  ${bars}
</svg>`;
}

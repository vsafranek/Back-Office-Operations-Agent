import type { DerivedChartModel } from "@/lib/agent/types";

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

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#64748b", "#0ea5e9"];

/**
 * Sloupcový graf jako SVG (stejná data jako UI); PNG vznikne přes sharp v chart-png.ts.
 * @deprecated Preferujte buildDerivedChartSvg pro nové grafy.
 */
export function buildBarChartSvg(chart: BarChartModel): string {
  const derived: DerivedChartModel = {
    kind: "bar",
    title: chart.title,
    axisLabelX: "",
    axisLabelY: "Hodnota",
    valueUnit: "",
    labels: chart.labels,
    values: chart.values,
    rowCountInTable: chart.values.reduce((a, b) => a + b, 0)
  };
  return buildDerivedChartSvg(derived);
}

function titleBlock(W: number, title: string, subtitle?: string): string {
  const t = escapeXmlText(title);
  const sub = subtitle?.trim()
    ? `<text x="${W / 2}" y="52" text-anchor="middle" font-size="12" fill="#64748b" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXmlText(subtitle)}</text>`
    : "";
  return `<text x="${W / 2}" y="32" text-anchor="middle" font-size="18" font-weight="600" fill="#0f172a" font-family="ui-sans-serif, system-ui, sans-serif">${t}</text>${sub}`;
}

/** SVG pro export PNG — titulky, osy a legenda v češtině (stejná metadata jako UI). */
export function buildDerivedChartSvg(chart: DerivedChartModel): string {
  const W = 880;
  const H = 480;
  const padL = 72;
  const padR = 36;
  const padT = 72;
  const padB = 100;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const axisY = escapeXmlText(chart.axisLabelY);
  const axisX = escapeXmlText(chart.axisLabelX);

  if (chart.kind === "pie") {
    return buildPieSvg(chart, W, H, padL, padR, padT, padB, plotW, plotH, axisX, axisY);
  }

  if (chart.kind === "line") {
    return buildLineSvg(chart, W, H, padL, padR, padT, padB, plotW, plotH, axisX, axisY);
  }

  return buildBarDerivedSvg(chart, W, H, padL, padR, padT, padB, plotW, plotH, axisX, axisY);
}

function buildBarDerivedSvg(
  chart: DerivedChartModel & { kind: "bar" },
  W: number,
  H: number,
  padL: number,
  padR: number,
  padT: number,
  padB: number,
  plotW: number,
  plotH: number,
  axisX: string,
  axisY: string
): string {
  const n = chart.labels.length;
  const maxV = Math.max(...chart.values, 1);
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
    const unit = chart.valueUnit ? ` ${escapeXmlText(chart.valueUnit)}` : "";

    bars += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(h, 2).toFixed(2)}" rx="4" fill="#3b82f6"/>`;
    bars += `<text x="${cx}" y="${(y - 8).toFixed(2)}" text-anchor="middle" font-size="13" font-weight="600" fill="#0f172a" font-family="ui-sans-serif, system-ui, sans-serif">${v}${unit}</text>`;
    bars += `<text x="${cx}" y="${H - 36}" text-anchor="middle" font-size="11" fill="#475569" font-family="ui-sans-serif, system-ui, sans-serif">${lbl}</text>`;
  }

  const noData =
    n === 0
      ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="15" fill="#64748b" font-family="ui-sans-serif, system-ui, sans-serif">Nedostatek dat pro graf.</text>`
      : "";

  const legend = legendSvg(chart.legend, W, H - 24);
  const yAxisLabel = `<text transform="translate(22 ${padT + plotH / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#475569" font-family="ui-sans-serif, system-ui, sans-serif">${axisY}</text>`;
  const xAxisLabel = `<text x="${padL + plotW / 2}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#475569" font-family="ui-sans-serif, system-ui, sans-serif">${axisX}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  ${titleBlock(W, chart.title, chart.subtitle)}
  ${yAxisLabel}
  ${xAxisLabel}
  ${noData}
  ${bars}
  ${legend}
</svg>`;
}

function legendSvg(legend: DerivedChartModel["legend"], W: number, y: number): string {
  if (!legend?.length) return "";
  let x = W - 220;
  let out = "";
  legend.forEach((item, i) => {
    const cy = y - (legend.length - i) * 18;
    const color = i === 0 ? "#3b82f6" : "#10b981";
    out += `<rect x="${x}" y="${cy - 10}" width="12" height="12" rx="2" fill="${color}"/>`;
    out += `<text x="${x + 18}" y="${cy}" font-size="11" fill="#334155" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXmlText(item.label)}</text>`;
  });
  return out;
}

function buildLineSvg(
  chart: DerivedChartModel & { kind: "line" },
  W: number,
  H: number,
  padL: number,
  padR: number,
  padT: number,
  padB: number,
  plotW: number,
  plotH: number,
  axisX: string,
  axisY: string
): string {
  const n = chart.labels.length;
  const s2 = chart.series2Values;
  const maxV = Math.max(1, ...chart.values, ...(s2 ?? []));

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / maxV) * plotH;

  let path1 = "";
  let path2 = "";
  for (let i = 0; i < n; i++) {
    const x = xAt(i);
    const y = yAt(chart.values[i] ?? 0);
    path1 += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  if (s2 && s2.length === n) {
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(s2[i] ?? 0);
      path2 += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }

  let dots = "";
  for (let i = 0; i < n; i++) {
    const x = xAt(i);
    dots += `<circle cx="${x.toFixed(1)}" cy="${yAt(chart.values[i] ?? 0).toFixed(1)}" r="4" fill="#3b82f6"/>`;
    if (s2 && s2.length === n) {
      dots += `<circle cx="${x.toFixed(1)}" cy="${yAt(s2[i] ?? 0).toFixed(1)}" r="4" fill="#10b981"/>`;
    }
  }

  let xLabels = "";
  for (let i = 0; i < n; i++) {
    const x = xAt(i);
    xLabels += `<text x="${x.toFixed(1)}" y="${H - 48}" text-anchor="middle" font-size="10" fill="#475569" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXmlText(truncateLabel(chart.labels[i] ?? "", 14))}</text>`;
  }

  const noData =
    n === 0
      ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="15" fill="#64748b">Nedostatek dat pro graf.</text>`
      : "";

  const line1 = path1 ? `<path d="${path1}" fill="none" stroke="#2563eb" stroke-width="2.5"/>` : "";
  const line2 = path2 ? `<path d="${path2}" fill="none" stroke="#059669" stroke-width="2.5"/>` : "";
  const legend = legendSvg(chart.legend, W, H - 24);
  const yAxisLabel = `<text transform="translate(22 ${padT + plotH / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#475569" font-family="ui-sans-serif, system-ui, sans-serif">${axisY}</text>`;
  const xAxisLabel = `<text x="${padL + plotW / 2}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#475569" font-family="ui-sans-serif, system-ui, sans-serif">${axisX}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  ${titleBlock(W, chart.title, chart.subtitle)}
  ${yAxisLabel}
  ${xAxisLabel}
  ${noData}
  <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#cbd5e1" stroke-width="1"/>
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#cbd5e1" stroke-width="1"/>
  ${line1}
  ${line2}
  ${dots}
  ${xLabels}
  ${legend}
</svg>`;
}

function buildPieSvg(
  chart: DerivedChartModel & { kind: "pie" },
  W: number,
  H: number,
  padL: number,
  padR: number,
  padT: number,
  padB: number,
  plotW: number,
  plotH: number,
  axisX: string,
  axisY: string
): string {
  const cx = padL + plotW * 0.35;
  const cy = padT + plotH / 2 + 10;
  const r = Math.min(plotW, plotH) * 0.38;
  const total = chart.values.reduce((a, b) => a + b, 0) || 1;
  let angle = -Math.PI / 2;
  let paths = "";
  chart.values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const fill = PIE_COLORS[i % PIE_COLORS.length]!;
    paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${fill}" stroke="#fff" stroke-width="2"/>`;
  });

  let legendPie = "";
  let lx = padL + plotW * 0.62;
  let ly = padT + 40;
  chart.labels.forEach((lbl, i) => {
    const fill = PIE_COLORS[i % PIE_COLORS.length]!;
    const v = chart.values[i] ?? 0;
    legendPie += `<rect x="${lx}" y="${ly}" width="10" height="10" fill="${fill}"/>`;
    legendPie += `<text x="${lx + 16}" y="${ly + 9}" font-size="11" fill="#334155" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXmlText(truncateLabel(`${lbl}: ${v}`, 36))}</text>`;
    ly += 18;
  });

  const noData =
    chart.labels.length === 0
      ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="15" fill="#64748b">Nedostatek dat pro graf.</text>`
      : "";

  const xAxisLabel = `<text x="${padL + plotW / 2}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#64748b" font-family="ui-sans-serif, system-ui, sans-serif">${axisX || "Kategorie"} · ${axisY}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  ${titleBlock(W, chart.title, chart.subtitle)}
  ${noData}
  ${paths}
  ${legendPie}
  ${xAxisLabel}
</svg>`;
}

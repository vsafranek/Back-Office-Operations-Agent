import type { AgentMarketListingCard } from "@/lib/agent/types";

function sourceBadgeColor(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("sreality")) return "#1d4ed8";
  if (s.includes("bezrealit")) return "#059669";
  return "#64748b";
}

export function MarketListingCardView({
  card,
  /** Omezí šířku karty (např. mřížka v postranním panelu). */
  maxWidthPx
}: {
  card: AgentMarketListingCard;
  maxWidthPx?: number;
}) {
  return (
    <article
      style={{
        ...(maxWidthPx != null && maxWidthPx > 0 ? { maxWidth: maxWidthPx, width: "100%" } : {}),
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 10",
          background: "linear-gradient(145deg, #e2e8f0, #f1f5f9)",
          position: "relative"
        }}
      >
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- externí CDN (Sreality); next/image by vyžadoval remotePatterns
          <img
            src={card.image_url}
            alt=""
            width={400}
            height={250}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "#94a3b8"
            }}
          >
            Bez náhledu
          </div>
        )}
      </div>
      <div style={{ padding: "12px 12px 14px", display: "grid", gap: 8 }}>
        <span
          style={{
            alignSelf: "start",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            color: "#fff",
            background: sourceBadgeColor(card.source),
            padding: "3px 8px",
            borderRadius: 999
          }}
        >
          {card.source}
        </span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: "#0f172a" }}>{card.title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.4 }}>{card.location}</p>
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
        >
          Otevřít inzerát →
        </a>
      </div>
    </article>
  );
}

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/listings/PortalListingsHome", () => ({
  PortalListingsHome: () => <div data-testid="portal-listings-home" />
}));

import HomePage from "@/app/page";

describe("app/page", () => {
  it("renders portal listings home entrypoint", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("portal-listings-home");
  });
});

import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  httpsRedirect,
  publicDisplayLocation,
  publicEventPath,
  publicEventSlug,
  toSitemapLastmod
} from "../src/public-url";

describe("public URL helpers", () => {
  it("cleans status-prefixed location labels", () => {
    expect(publicDisplayLocation("Behobener Stromausfall in Seewen")).toBe("Seewen");
    expect(publicDisplayLocation("Geplanter Stromunterbruch in Diegten")).toBe("Diegten");
    expect(publicDisplayLocation("in Lupsingen")).toBe("Lupsingen");
    expect(publicDisplayLocation("Lufingen und Winkel")).toBe("Lufingen und Winkel");
  });

  it("builds slugs from cleaned locations", () => {
    expect(publicEventSlug("Behobener Stromausfall in Seewen")).toBe("seewen");
    expect(publicEventPath({ id: 110, location: "Behobener Stromausfall in Seewen" }))
      .toBe("/stromausfall/seewen-110");
  });

  it("formats sitemap lastmod as ISO timestamps", () => {
    expect(toSitemapLastmod("2026-08-04 19:15:15")).toBe("2026-08-04T19:15:15.000Z");
    expect(toSitemapLastmod("2026-07-30")).toMatch(/^2026-07-30/);
  });

  it("forces production HTTP and www hosts onto https://outage.ch", () => {
    const http = httpsRedirect(new Request("http://outage.ch/ratgeber/"));
    expect(http?.headers.get("Location")).toBe("https://outage.ch/ratgeber/");
    const www = httpsRedirect(new Request("https://www.outage.ch/stromausfall/seewen-110"));
    expect(www?.headers.get("Location")).toBe("https://outage.ch/stromausfall/seewen-110");
    expect(httpsRedirect(new Request("https://outage.ch/"))).toBeNull();
  });

  it("builds absolute https URLs", () => {
    expect(absoluteUrl("/og-default.png")).toBe("https://outage.ch/og-default.png");
  });
});

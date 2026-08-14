import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSwissLocation, reverseGeocodeSwissMunicipality } from "../src/geo";

describe("Swiss location normalization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses geo.admin.ch SearchServer labels for Swiss place normalization", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              attrs: {
                label: "<b>Belp</b>",
                origin: "gg25"
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await normalizeSwissLocation("Gemeinde Belp");

    expect(result).toMatchObject({
      normalizedLocation: "belp",
      label: "Belp",
      source: "geo.admin.ch"
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not collapse multi-place alerts through a single geo match", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await normalizeSwissLocation("Belp, Köniz, Ittigen");

    expect(result.normalizedLocation).toBe("belp koniz ittigen");
    expect(result.source).toBe("fallback");
    expect(result.reason).toBe("multi_place");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reverse-geocodes WGS84 coordinates to the current Swiss municipality", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              attributes: {
                gemname: "Lützelflüh 1893",
                label: "Lützelflüh 1893",
                is_current_jahr: false,
                jahr: 1893
              }
            },
            {
              attributes: {
                gemname: "Lützelflüh",
                label: "Lützelflüh",
                is_current_jahr: true,
                jahr: 2024,
                kanton: "BE"
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reverseGeocodeSwissMunicipality(47.005, 7.686);

    expect(result).toEqual({ municipality: "Lützelflüh", canton: "BE" });
    const identifyUrl = decodeURIComponent(String((fetchMock.mock.calls as unknown[][])[0]?.[0] ?? ""));
    expect(identifyUrl).toContain("MapServer/identify");
    expect(identifyUrl).toContain("7.686");
    expect(identifyUrl).toContain("47.005");
  });

  it("returns null outside Switzerland instead of inventing a place", async () => {
    const result = await reverseGeocodeSwissMunicipality(48.8566, 2.3522);
    expect(result).toBeNull();
  });
});

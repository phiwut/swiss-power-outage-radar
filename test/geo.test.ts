import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSwissLocation } from "../src/geo";

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
});

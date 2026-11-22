import { describe, expect, it } from "vitest";
import { collectAnimatedRoomParts } from "./roomAnimation";

describe("room frame-update cache", () => {
  it("keeps static room children out of per-frame animation work", () => {
    const markers = [
      "hauntGlow",
      "spiritLight",
      "waterSurface",
      "spirit",
      "roomLight",
      "cutaway",
    ] as const;
    const animated = markers.map((marker) => ({
      userData: { [marker]: marker === "cutaway" ? { side: "north" } : true },
    }));
    const staticParts = Array.from({ length: 30 }, () => ({ userData: {} }));

    expect(collectAnimatedRoomParts([...staticParts, ...animated])).toEqual(
      animated,
    );
  });
});

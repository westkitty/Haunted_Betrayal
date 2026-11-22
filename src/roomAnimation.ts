type RoomScenePart = {
  userData: Record<string, unknown>;
};

/** Identify the small subset of room children whose properties change per frame. */
export function collectAnimatedRoomParts<T extends RoomScenePart>(
  children: readonly T[],
): T[] {
  return children.filter(({ userData }) =>
    Boolean(
      userData.hauntGlow ||
        userData.spiritLight ||
        userData.waterSurface ||
        userData.spirit ||
        userData.roomLight ||
        userData.cutaway,
    ),
  );
}

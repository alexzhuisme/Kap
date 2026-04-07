/** Safe name compare for plugin objects (npm or local metadata may omit prettyName). */
export const comparePluginsByPrettyName = (a, b) =>
  String(a?.prettyName ?? '').localeCompare(String(b?.prettyName ?? ''));

/** Discover tab: compatible plugins first, then by display name. */
export const comparePluginsForDiscover = (a, b) => {
  if (a.isCompatible !== b.isCompatible) {
    return Number(b.isCompatible) - Number(a.isCompatible);
  }

  return comparePluginsByPrettyName(a, b);
};

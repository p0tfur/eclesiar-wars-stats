/**
 * Mapping item_id from API to item name
 * used to show weapon used for specific hits
 *
 * null = Hand (no weapon)
 * 18-14 = Weapon Quality 1-5 (WQ1-WQ5)
 * 2-6 = Aircraft Quality 1-5 (AQ1-AQ5)
 */

export const ITEM_MAPPING = {
  null: "Hand",
  8: "WQ1",
  9: "WQ2",
  10: "WQ3",
  11: "WQ4",
  12: "WQ5",
  20: "AQ1",
  21: "AQ2",
  22: "AQ3",
  23: "AQ4",
  24: "AQ5",
};

/**
 * Returns name of item using item_id
 * @param {number|null} itemId - ID API
 * @returns {string} - Item anem (eg. 'WQ1', 'Hand')
 */
export function getItemName(itemId) {
  // handle null as key
  if (itemId === null || itemId === undefined) {
    return ITEM_MAPPING[null];
  }
  return ITEM_MAPPING[itemId] || `Unknown (${itemId})`;
}

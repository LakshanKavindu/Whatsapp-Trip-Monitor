const { placeMatches } = require("./locations");
const { vehicleMatches } = require("./vehicles");

/**
 * filter shape: { id, label, pickup, drop, vehicle, enabled }
 * Empty pickup/drop/vehicle = wildcard ("anywhere" / "any vehicle").
 *
 * Returns the list of enabled filters that match this parsed message.
 */
function findMatches(parsedMessage, filters) {
  // Use the extracted pickup/drop field when we have one. Only fall back
  // to scanning the whole message when parsing didn't find that field at
  // all — otherwise a pickup filter could wrongly match text that only
  // appears in the drop field (or vice versa).
  const haystackForPickup = parsedMessage.pickup || parsedMessage.normalizedText;
  const haystackForDrop = parsedMessage.drop || parsedMessage.normalizedText;

  return (filters || []).filter((f) => {
    if (!f.enabled) return false;

    const pickupOk = !f.pickup || placeMatches(haystackForPickup, f.pickup);
    const dropOk = !f.drop || placeMatches(haystackForDrop, f.drop);
    const vehicleOk = !f.vehicle || vehicleMatches(parsedMessage.vehicle, f.vehicle);

    return pickupOk && dropOk && vehicleOk;
  });
}

module.exports = { findMatches };

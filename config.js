/**
 * Edit this file to control what the bot watches for.
 * No need to touch index.js for day-to-day tweaks.
 */

module.exports = {
  // Leave empty [] to watch ALL groups you're in.
  // To restrict to specific groups, add their WhatsApp group JIDs here,
  // e.g. "1203630XXXX-15551234@g.us". The bot will print JIDs of
  // incoming group messages to the console on first run so you can
  // copy them from there.
  watchedGroupIds: [],

  // Case-insensitive keywords — a message matches if it contains ANY of these.
  keywords: [
    "route",
    "trip",
    "departure",
    "itinerary",
    "tour",
    "excursion",
  ],

  // Optional regex patterns for more precise matching (e.g. dates, prices,
  // specific route codes). A message matches if it hits ANY pattern here
  // OR any keyword above — matching is OR across both lists.
  regexPatterns: [
    // Example: matches "12/25", "12-25", "Dec 25" style dates
    // /\b\d{1,2}[\/\-]\d{1,2}\b/,
  ],

  // If true, a message must match keywords/regex to notify (default).
  // If false, EVERY group message triggers a notification (useful for
  // testing your setup, not recommended long-term).
  requireMatch: true,

  // Minimum milliseconds between notifications, to avoid a flood of
  // toasts if a group gets a burst of matching messages.
  notificationCooldownMs: 3000,
};

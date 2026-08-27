const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getMessaging: getFirebaseMessaging } = require("firebase-admin/messaging");

let initialized = false;
let warned = false;

function getMessaging() {
  if (initialized) return getFirebaseMessaging();

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    if (!warned) {
      console.log(
        "[fcm] Firebase is not configured. Add FIREBASE_PROJECT_ID, " +
          "FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to .env."
      );
      warned = true;
    }
    return null;
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }
  initialized = true;
  return getFirebaseMessaging();
}

async function sendMatchedPush(supabase, row) {
  const messaging = getMessaging();
  if (!messaging) return;

  const { data: tokens, error } = await supabase
    .from("push_tokens")
    .select("token");
  if (error) throw error;
  if (!tokens || tokens.length === 0) return;

  const title = `${row.pickup || "Anywhere"} -> ${row.drop_location || "Anywhere"}`;
  const body = [row.vehicle, row.date_text, row.time_text, row.price]
    .filter(Boolean)
    .join(" | ") || "New matching trip";

  const result = await messaging.sendEachForMulticast({
    tokens: tokens.map(({ token }) => token),
    data: {
      id: row.id || "",
      created_at: row.created_at || "",
      pickup: row.pickup || "",
      drop_location: row.drop_location || "",
      group_name: row.group_name || "",
      vehicle: row.vehicle || "",
      date_text: row.date_text || "",
      time_text: row.time_text || "",
      passengers: row.passengers || "",
      price: row.price || "",
      contact: row.contact || "",
      other_details: row.other_details || "",
      title,
      body,
    },
    webpush: {
      notification: { title, body, icon: "/icon-192.png", vibrate: [200, 100, 200] },
      fcmOptions: { link: "/" },
    },
  });

  console.log(
    `[fcm] sent ${result.successCount} notification(s), ${result.failureCount} failure(s)`
  );

  const invalidTokens = tokens
    .filter((_, index) => {
      const code = result.responses[index]?.error?.code || "";
      return code.includes("registration-token-not-registered") || code.includes("invalid-registration-token");
    })
    .map(({ token }) => token);
  if (invalidTokens.length > 0) {
    await supabase.from("push_tokens").delete().in("token", invalidTokens);
  }

  return result;
}

module.exports = { sendMatchedPush };
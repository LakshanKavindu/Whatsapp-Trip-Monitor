const listEl = document.getElementById("list");
const emptyMsg = document.getElementById("emptyMsg");
const statusDot = document.getElementById("statusDot");
const enableSoundBtn = document.getElementById("enableSound");
const alertSound = document.getElementById("alertSound");
const pushStatus = document.getElementById("pushStatus");
const pwaFilterForm = document.getElementById("pwaFilterForm");
const pwaFilterList = document.getElementById("pwaFilterList");
const filterEmpty = document.getElementById("filterEmpty");

document.querySelectorAll(".nav-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
    button.classList.add("active");
    document.getElementById(button.dataset.view).classList.add("active-view");
  });
});

let supabaseClient = null;
try {
  if (!window.supabase || !window.SUPABASE_CONFIG) {
    throw new Error("Supabase configuration or library did not load");
  }
  const cfg = window.SUPABASE_CONFIG;
  supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
} catch (error) {
  pushStatus.textContent = `App startup error: ${error.message}`;
}

window.addEventListener("error", (event) => {
  pushStatus.textContent = `App error: ${event.message || "script failed to load"}`;
});
window.addEventListener("unhandledrejection", (event) => {
  pushStatus.textContent = `App error: ${event.reason?.message || event.reason || "operation failed"}`;
});

let soundEnabled = window.soundEnabled === true;
let serviceWorkerRegistration = null;
let audioContext = null;
const serviceWorkerReady = "serviceWorker" in navigator
  ? navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(
        registrations
          .filter((registration) => !registration.active?.scriptURL.includes("service-worker.js?v=7"))
          .map((registration) => registration.unregister())
      ))
      .then(() => navigator.serviceWorker.register("service-worker.js?v=7"))
  : Promise.resolve(null);

if (localStorage.getItem("tripAlertsEnabled") === "true" || Notification.permission === "granted") {
  enableSoundBtn.classList.add("hidden");
}

window.enableTripAlertSound = () => {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.resume().then(() => {
    soundEnabled = true;
    window.soundEnabled = true;
    playAlertSound();
  }).catch(() => {});
};

window.playTripAlertSound = () => {
  if (!soundEnabled) window.enableTripAlertSound();
  else playAlertSound();
};

async function startAlertSetup() {
  pushStatus.textContent = "Checking notification permissions...";
  // Audio is optional; never block push enrollment on a missing or unsupported sound file.
  alertSound.play().then(() => {
    alertSound.pause();
    alertSound.currentTime = 0;
    soundEnabled = true;
  }).catch(() => {});
  const registered = await registerPushNotifications();
  if (registered) enableSoundBtn.classList.add("hidden");
}

async function registerPushNotifications() {
  const firebaseConfig = window.FIREBASE_CONFIG;
  if (!firebaseConfig || firebaseConfig.apiKey.startsWith("REPLACE_")) {
    pushStatus.textContent = "Firebase web configuration is missing.";
    return false;
  }

  try {
    if (!supabaseClient) {
      pushStatus.textContent = "Supabase did not load. Refresh the HTTPS Netlify page.";
      return false;
    }
    pushStatus.textContent = "Registering this phone for background alerts...";
    if (!window.isSecureContext) {
      pushStatus.textContent = "Notifications require the secure HTTPS Netlify address.";
      return false;
    }
    if (!("Notification" in window)) {
      pushStatus.textContent = "This browser does not support notifications.";
      return false;
    }
    if (Notification.permission === "denied") {
      pushStatus.textContent = "Notifications are blocked. Allow them in this site's browser settings, then reload.";
      return false;
    }
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    serviceWorkerRegistration = await serviceWorkerReady;
    if (permission !== "granted") {
      pushStatus.textContent = "Notification permission was not allowed.";
      return false;
    }
    if (!serviceWorkerRegistration) {
      pushStatus.textContent = "Service worker could not start. Use the HTTPS Netlify URL.";
      return false;
    }

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: firebaseConfig.vapidKey,
      serviceWorkerRegistration,
    });
    if (!token) {
      pushStatus.textContent = "Firebase did not provide a phone token.";
      return false;
    }

    const { error } = await supabaseClient.rpc("register_push_token", { p_token: token });
    if (error) {
      console.error("Failed to register push notifications:", error.message);
      pushStatus.textContent = `Could not save phone registration: ${error.message}`;
      return false;
    }
    pushStatus.textContent = "Background alerts are enabled on this phone.";
    return true;
  } catch (error) {
    console.error("Push notifications are unavailable:", error.message);
    pushStatus.textContent = `Background alerts failed: ${error.message}`;
    return false;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Converts a raw extracted contact string into a wa.me link. Sri Lankan
// numbers are commonly written starting with 0 (local format) — wa.me
// needs the international format (country code, no leading 0).
function toWhatsAppLink(rawContact) {
  const digits = (rawContact.match(/\d+/g) || []).join("");
  if (!digits) return null;

  let intl = digits;
  if (digits.startsWith("0") && digits.length === 10) {
    intl = "94" + digits.slice(1); // Sri Lanka country code
  } else if (digits.length === 9) {
    intl = "94" + digits; // missing leading 0 entirely
  }
  return `https://wa.me/${intl}`;
}

function buildCard(row) {
  const div = document.createElement("div");
  div.className = "trip-card";

  const time = new Date(row.created_at).toLocaleTimeString();
  const pickup = row.pickup ? escapeHtml(row.pickup) : "Anywhere";
  const drop = row.drop_location ? escapeHtml(row.drop_location) : "Anywhere";

  const stats = [
    ["Vehicle", row.vehicle],
    ["Date", row.date_text],
    ["Time", row.time_text],
    ["Passengers", row.passengers],
    ["Price", row.price, "price"],
  ].filter(([, v]) => v);

  const statsHtml = stats
    .map(([k, v, cls]) => `<div class="trip-stat ${cls || ""}"><span class="k">${k}</span><span class="v">${escapeHtml(v)}</span></div>`)
    .join("");

  const waLink = row.contact ? toWhatsAppLink(row.contact) : null;

  div.innerHTML = `
    <div class="trip-route">${pickup}<span class="arrow">→</span>${drop}</div>
    <div class="trip-time">${time}${row.group_name ? " · " + escapeHtml(row.group_name) : ""}</div>
    <div class="trip-grid">${statsHtml}</div>
    ${waLink ? `<a class="call-btn" href="${waLink}">📞 Open WhatsApp — ${escapeHtml(row.contact)}</a>` : ""}
    ${row.other_details ? `<div class="trip-other">${escapeHtml(row.other_details)}</div>` : ""}
  `;

  return div;
}

function prependRow(row) {
  emptyMsg.style.display = "none";
  listEl.insertBefore(buildCard(row), listEl.firstChild);

  while (listEl.children.length > 50) {
    listEl.removeChild(listEl.lastChild);
  }
}

async function loadRecent() {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("matched", true)
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) {
    console.error("Failed to load recent trips:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }

  emptyMsg.style.display = "none";
  data.forEach((row, index) => {
    try {
      listEl.appendChild(buildCard(row));
    } catch (error) {
      console.error(`[trips] render failed for row ${index}`, error, row);
      pushStatus.textContent = `[trips] render failed for row ${index}: ${error.message}`;
    }
  });
}

function renderPwaFilters(filters) {
  pwaFilterList.replaceChildren();
  filterEmpty.style.display = filters.length === 0 ? "block" : "none";
  filters.forEach((filter) => {
    const item = document.createElement("div");
    item.className = `saved-filter${filter.enabled ? "" : " disabled"}`;

    const details = document.createElement("div");
    details.className = "saved-filter-details";
    const route = document.createElement("strong");
    route.textContent = `${filter.pickup || "Anywhere"} -> ${filter.drop_location || "Anywhere"}`;
    details.appendChild(route);
    if (filter.vehicle) {
      const vehicle = document.createElement("span");
      vehicle.textContent = filter.vehicle;
      details.appendChild(vehicle);
    }

    const actions = document.createElement("div");
    actions.className = "filter-actions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `toggle-btn${filter.enabled ? " active" : ""}`;
    toggle.textContent = filter.enabled ? "On" : "Off";
    toggle.onclick = async () => {
      const { error } = await supabaseClient.rpc("set_trip_filter_enabled", {
        p_id: filter.id,
        p_enabled: !filter.enabled,
      });
      if (error) console.error("Filter update failed:", error.message);
      else loadPwaFilters();
    };
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "Delete";
    remove.onclick = async () => {
      const { error } = await supabaseClient.rpc("delete_trip_filter", { p_id: filter.id });
      if (error) console.error("Filter delete failed:", error.message);
      else loadPwaFilters();
    };
    actions.append(toggle, remove);
    item.append(details, actions);
    pwaFilterList.appendChild(item);
  });
}

async function loadPwaFilters() {
  const { data, error } = await supabaseClient
    .from("trip_filters")
    .select("id,label,pickup,drop_location,vehicle,enabled,created_at")
    .order("created_at", { ascending: true });
  if (error) {
    filterEmpty.textContent = `Could not load filters: ${error.message}`;
    filterEmpty.style.display = "block";
    return;
  }
  renderPwaFilters(data || []);
}

function subscribeFilterChanges() {
  if (!supabaseClient) return;
  supabaseClient
    .channel("trip-filter-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_filters" },
      () => loadPwaFilters()
    )
    .subscribe();
}

pwaFilterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pickup = document.getElementById("filterPickup").value.trim();
  const drop = document.getElementById("filterDrop").value.trim();
  const vehicle = document.getElementById("filterVehicle").value.trim();
  if (!pickup && !drop && !vehicle) return;

  const label = `${pickup || "Anywhere"} -> ${drop || "Anywhere"}`;
  const { error } = await supabaseClient.rpc("create_trip_filter", {
    p_label: label,
    p_pickup: pickup,
    p_drop_location: drop,
    p_vehicle: vehicle,
  });
  if (error) {
    console.error("Filter save failed:", error.message);
    return;
  }
  pwaFilterForm.reset();
  loadPwaFilters();
});

function playAlertSound() {
  if (!soundEnabled) return;
  if (!audioContext) return;

  const now = audioContext.currentTime;
  [0, 0.16].forEach((offset, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = index === 0 ? 880 : 1175;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.15);
  });
}

function subscribeRealtime() {
  const channel = supabaseClient
    .channel("matched-trips")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: "matched=eq.true" },
      (payload) => {
        prependRow(payload.new);
        playAlertSound();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    )
    .subscribe((status) => {
      statusDot.classList.toggle("connected", status === "SUBSCRIBED");
      statusDot.title = status;
    });

  return channel;
}

function subscribeForegroundPush() {
  if (!window.firebase || !window.FIREBASE_CONFIG) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    firebase.messaging().onMessage((payload) => {
      const row = { ...payload.data, matched: true };
      if (row.id) prependRow(row);
      playAlertSound();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    });
  } catch (error) {
    console.error("Foreground push setup failed:", error.message);
  }
}

loadRecent();
loadPwaFilters();
subscribeFilterChanges();
subscribeRealtime();
subscribeForegroundPush();

serviceWorkerReady.then((registration) => {
  serviceWorkerRegistration = registration;
}).catch(() => {});

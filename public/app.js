const filterForm = document.getElementById("filterForm");
const filterList = document.getElementById("filterList");
const filterEmpty = document.getElementById("filterEmpty");
const feed = document.getElementById("feed");
const matchFeed = document.getElementById("matchFeed");

async function fetchFilters() {
  const res = await fetch("/api/filters");
  return res.json();
}

async function renderFilters() {
  const filters = await fetchFilters();
  filterList.innerHTML = "";
  filterEmpty.style.display = filters.length === 0 ? "block" : "none";

  filters.forEach((f) => {
    const item = document.createElement("div");
    item.className = "filter-item" + (f.enabled ? "" : " disabled");

    const main = document.createElement("div");
    main.className = "filter-main";
    const route = document.createElement("div");
    route.className = "filter-route";
    route.textContent = `${f.pickup || "Anywhere"} → ${f.drop || "Anywhere"}`;
    main.appendChild(route);
    if (f.vehicle) {
      const veh = document.createElement("div");
      veh.className = "filter-vehicle";
      veh.textContent = `Vehicle: ${f.vehicle}`;
      main.appendChild(veh);
    }

    const actions = document.createElement("div");
    actions.className = "filter-actions";

    const toggle = document.createElement("button");
    toggle.className = "toggle" + (f.enabled ? " on" : "");
    toggle.title = f.enabled ? "Disable" : "Enable";
    toggle.onclick = async () => {
      await fetch(`/api/filters/${f.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !f.enabled }),
      });
      renderFilters();
    };

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.onclick = async () => {
      await fetch(`/api/filters/${f.id}`, { method: "DELETE" });
      renderFilters();
    };

    actions.appendChild(toggle);
    actions.appendChild(del);

    item.appendChild(main);
    item.appendChild(actions);
    filterList.appendChild(item);
  });
}

filterForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pickup = document.getElementById("fPickup").value;
  const drop = document.getElementById("fDrop").value;
  const vehicle = document.getElementById("fVehicle").value;

  await fetch("/api/filters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pickup, drop, vehicle }),
  });

  filterForm.reset();
  renderFilters();
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildCard(entry) {
  const div = document.createElement("div");
  const matched = entry.matchedFilterIds && entry.matchedFilterIds.length > 0;
  div.className = "feed-item" + (matched ? " matched" : "");

  const p = entry.parsed || {};
  const time = new Date(entry.at).toLocaleTimeString();

  // Top row: route headline + meta/badges
  const top = document.createElement("div");
  top.className = "feed-top";

  const route = document.createElement("div");
  route.className = "feed-route";
  const pickupText = p.pickup ? escapeHtml(p.pickup) : '<span class="anywhere">Anywhere</span>';
  const dropText = p.drop ? escapeHtml(p.drop) : '<span class="anywhere">Anywhere</span>';
  route.innerHTML = `${pickupText}<span class="arrow">→</span>${dropText}`;

  const meta = document.createElement("div");
  meta.className = "feed-meta";
  const metaLine = document.createElement("div");
  metaLine.textContent = `${time} · ${entry.source}${entry.groupName ? " · " + entry.groupName : ""}`;
  meta.appendChild(metaLine);
  if (matched) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "MATCH";
    meta.appendChild(badge);
  }

  top.appendChild(route);
  top.appendChild(meta);

  // Field grid
  const grid = document.createElement("div");
  grid.className = "feed-grid";

  const stats = [
    ["Vehicle", p.vehicle, "vehicle"],
    ["Date", p.date, "date"],
    ["Time", p.time, "time"],
    ["Passengers", p.passengers, "passengers"],
    ["Price", p.price, "price"],
    ["Contact", p.contact, "contact"],
  ].filter(([, value]) => value);

  if (stats.length === 0) {
    const empty = document.createElement("div");
    empty.className = "feed-empty-fields";
    empty.textContent = "No structured fields recognized in this message.";
    grid.appendChild(empty);
  } else {
    stats.forEach(([label, value, cls]) => {
      const stat = document.createElement("div");
      stat.className = "feed-stat " + cls;
      stat.innerHTML = `<span class="k">${label}</span><span class="v">${escapeHtml(value)}</span>`;
      grid.appendChild(stat);
    });
  }

  div.appendChild(top);
  div.appendChild(grid);

  if (p.otherDetails) {
    const other = document.createElement("div");
    other.className = "feed-other";
    other.innerHTML = `<span class="k">Other details</span><span class="v">${escapeHtml(p.otherDetails)}</span>`;
    div.appendChild(other);
  }

  return div;
}

async function renderFeed() {
  const res = await fetch("/api/log");
  const log = await res.json();

  feed.innerHTML = "";
  matchFeed.innerHTML = "";

  if (log.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No messages received yet.";
    feed.appendChild(empty);
  } else {
    log.forEach((entry) => feed.appendChild(buildCard(entry)));
  }

  const matches = log.filter((e) => e.matchedFilterIds && e.matchedFilterIds.length > 0);
  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No matches yet.";
    matchFeed.appendChild(empty);
  } else {
    matches.forEach((entry) => matchFeed.appendChild(buildCard(entry)));
  }
}

document.getElementById("testSend").addEventListener("click", async () => {
  const text = document.getElementById("testMessage").value;
  if (!text.trim()) return;

  await fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source: "manual_test", groupName: "Test" }),
  });

  document.getElementById("testMessage").value = "";
  renderFeed();
});

renderFilters();
renderFeed();
setInterval(renderFeed, 3000);
setInterval(renderFilters, 2000);

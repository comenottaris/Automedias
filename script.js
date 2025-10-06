// script.js — front fetch from Netlify function, fallback to db.json
const API_ENDPOINT = "/.netlify/functions/get_sites";
const FALLBACK_JSON = "db.json"; // dev fallback

let dbData = [];

// DOM refs
const container = document.getElementById("cards-container");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const closeBtn = document.querySelector(".close");
const selectType = document.getElementById("filter-type");
const selectCountry = document.getElementById("filter-country");
const searchInput = document.getElementById("search");

// Load data: try API first, else fallback to local file
async function loadData() {
  try {
    const resp = await fetch(API_ENDPOINT, {cache: "no-store"});
    if (!resp.ok) throw new Error("API fetch failed: " + resp.status);
    const json = await resp.json();
    console.log("Loaded from API:", json.length, "records");
    dbData = normalizeArray(json);
  } catch (err) {
    console.warn("API fetch failed, falling back to local", err);
    try {
      const resp2 = await fetch(FALLBACK_JSON);
      const json2 = await resp2.json();
      dbData = normalizeArray(json2);
      console.log("Loaded from local db.json:", dbData.length, "records");
    } catch (e2) {
      console.error("Fallback load failed:", e2);
      dbData = [];
    }
  }

  populateFilters();
  applyFilters(); // initial render
}

// Normalize entries to expected shape (defensive)
function normalizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    // If the function returned rows from PG, platforms may already be object arrays.
    // Ensure fields exist and have canonical types.
    return {
      url: item.url || item.URL || item.link || "",
      title: item.title || item.name || "",
      type: item.type || "",
      language: item.language || "",
      country: item.country || "",
      // platforms could be stringified JSON in some setups — try to parse safely
      platforms: parsePossiblyStringified(item.platforms) || [],
      data_formats: parsePossiblyStringified(item.data_formats) || [],
      emails: parsePossiblyStringified(item.emails) || [],
      html_path: item.html_path || item.htmlPath || "",
      md_path: item.md_path || item.mdPath || "",
      wayback_status: item.wayback_status || item.wayback || "",
      notes: item.notes || ""
    };
  });
}

function parsePossiblyStringified(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    // try to parse JSON; if fails, return single-element array with string
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }
  // if object (e.g. a single platform object), wrap in array
  if (typeof value === "object") return [value];
  return [String(value)];
}

// --- Render cards ---
function displayCards(items) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = `<div style="color:var(--muted);padding:20px">Aucun résultat.</div>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;

    // Title + meta
    const title = document.createElement("h2");
    title.textContent = item.title || item.url;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.country || "—"} · ${item.language || "—"} · ${item.type || "—"}`;

    // Social links (clickable directly)
    const socialLinksDiv = document.createElement("div");
    socialLinksDiv.className = "social-links";
    if (Array.isArray(item.platforms) && item.platforms.length) {
      item.platforms.forEach((p, idx) => {
        // p can be {"name","url"} or just string
        let name = "", url = "";
        if (typeof p === "string") { name = p; url = p.startsWith("http") ? p : ""; }
        else if (p && typeof p === "object") {
          name = p.name || p.platform || p.title || "";
          url = p.url || p.link || "";
        }
        if (!name && url) name = url;
        if (!url && name && isLikelyUrl(name)) url = name;
        const a = document.createElement("a");
        a.className = "social-link";
        a.href = url || "#";
        a.textContent = name || url || "link";
        if (url) a.target = "_blank";
        // stopPropagation so clicking link doesn't open modal
        a.addEventListener("click", (ev) => ev.stopPropagation());
        socialLinksDiv.appendChild(a);
        if (idx < item.platforms.length - 1) {
          const sep = document.createTextNode(" ");
          socialLinksDiv.appendChild(sep);
        }
      });
    }

    // tags (data_formats)
    const tagsDiv = document.createElement("div");
    tagsDiv.className = "tags";
    (item.data_formats || []).forEach(f => {
      const sp = document.createElement("span");
      sp.textContent = (typeof f === "string") ? f : (f.name || String(f));
      tagsDiv.appendChild(sp);
    });

    // Build card inner
    card.appendChild(title);
    card.appendChild(meta);
    if (socialLinksDiv.childElementCount) card.appendChild(socialLinksDiv);
    if (tagsDiv.childElementCount) card.appendChild(tagsDiv);

    // Click on card opens modal (except clicks on social links)
    card.addEventListener("click", () => openModal(item));
    // keyboard accessibility
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(item);
      }
    });

    container.appendChild(card);
  });
}

function isLikelyUrl(s) {
  return typeof s === "string" && (s.startsWith("http://") || s.startsWith("https://") || s.includes(".com") || s.includes("t.me/"));
}

// --- Modal ---
function openModal(item) {
  // build social html
  let socialHTML = "";
  if (Array.isArray(item.platforms) && item.platforms.length) {
    const links = item.platforms.map(p => {
      if (typeof p === "string") return `<a href="${escapeHtml(p)}" target="_blank">${escapeHtml(p)}</a>`;
      const name = escapeHtml(p.name || p.platform || p.title || "");
      const url = escapeHtml(p.url || p.link || "");
      return url ? `<a href="${url}" target="_blank">${name || url}</a>` : `${name}`;
    }).join(" · ");
    socialHTML = `<p><strong>Réseaux :</strong> ${links}</p>`;
  }

  const emails = (item.emails || []).map(e => escapeHtml(e)).join(", ") || "—";
  const formats = (item.data_formats || []).map(f => (typeof f === "string" ? f : (f.name || String(f)))).join(", ") || "—";

  modalBody.innerHTML = `
    <div class="modal-body">
      <h2>${escapeHtml(item.title || item.url)}</h2>
      <p><strong>URL :</strong> <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></p>
      <p><strong>Type :</strong> ${escapeHtml(item.type || "—")}</p>
      <p><strong>Pays :</strong> ${escapeHtml(item.country || "—")}</p>
      <p><strong>Langue :</strong> ${escapeHtml(item.language || "—")}</p>
      ${socialHTML}
      <p><strong>Formats :</strong> ${escapeHtml(formats)}</p>
      <p><strong>Emails :</strong> ${escapeHtml(emails)}</p>
      <p><strong>Wayback :</strong> ${escapeHtml(item.wayback_status || "—")}</p>
      <p><strong>Notes :</strong> ${escapeHtml(item.notes || "")}</p>
    </div>
  `;
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}

// close handlers
closeBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e)=> { if (e.target === modal) closeModal(); });
function closeModal(){
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
  modalBody.innerHTML = "";
}

// --- Filters ---
function populateFilters() {
  const types = new Set();
  const countries = new Set();
  dbData.forEach(d => {
    if (d.type) types.add(d.type);
    if (d.country) countries.add(d.country);
  });

  // reset selects
  selectType.innerHTML = '<option value="">Tous types</option>';
  selectCountry.innerHTML = '<option value="">Tous pays</option>';

  Array.from(types).sort().forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    selectType.appendChild(opt);
  });
  Array.from(countries).sort().forEach(c => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    selectCountry.appendChild(opt);
  });
}

// filter & search
function applyFilters() {
  const typeVal = selectType.value;
  const countryVal = selectCountry.value;
  const q = (searchInput.value || "").trim().toLowerCase();

  const filtered = dbData.filter(d => {
    if (typeVal && d.type !== typeVal) return false;
    if (countryVal && d.country !== countryVal) return false;
    if (!q) return true;
    // search in title, url, country, platform names
    if ((d.title || "").toLowerCase().includes(q)) return true;
    if ((d.url || "").toLowerCase().includes(q)) return true;
    if ((d.country || "").toLowerCase().includes(q)) return true;
    if (Array.isArray(d.platforms) && d.platforms.some(p => {
      const name = (typeof p === "string") ? p : (p.name || p.platform || "");
      return (name || "").toLowerCase().includes(q) || ((p.url||"")+"").toLowerCase().includes(q);
    })) return true;
    return false;
  });

  displayCards(filtered);
}

// helpers
function escapeHtml(s){
  if (s === null || s === undefined) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// events
selectType.addEventListener("change", applyFilters);
selectCountry.addEventListener("change", applyFilters);
searchInput.addEventListener("input", applyFilters);

// start
document.addEventListener("DOMContentLoaded", loadData);

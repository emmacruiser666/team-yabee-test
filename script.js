const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content?.trim() || "0.0";
const VERSION_CHECK_INTERVAL = 10 * 60 * 1000;
let autoSaveInterval;
let saveNotificationTimer;
let updateCheckInterval;
let appReadyForSaveNotifications = false;

function getBackupFilename(prefix) {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");
    return `${prefix}-${year}-${month}-${day}_${hour}-${minute}.json`;
}

function buildBackupData() {
    const now = new Date();
    return {
        backupCreated: getFullDateTime(),
        exportedAt: now.toISOString(),
        note: "Team Yabee Grooming Backup - Created on " + getFullDateTime(),
        ...db
    };
}

function downloadBackup(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function showSaveNotification(text = "Auto-saved") {
    const notif = document.getElementById("saveNotification");
    if (!notif) return;
    notif.textContent = text;
    notif.style.display = "block";
    clearTimeout(saveNotificationTimer);
    saveNotificationTimer = setTimeout(() => notif.style.display = "none", 2500);
}

function compareVersions(a, b) {
    const left = String(a || "").trim().split(".").map((part) => parseInt(part, 10) || 0);
    const right = String(b || "").trim().split(".").map((part) => parseInt(part, 10) || 0);
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i++) {
        const diff = (left[i] || 0) - (right[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function setUpdateStatus(message, tone = "") {
    const statusEl = document.getElementById("updateStatus");
    if (!statusEl) return;
    if (!message) {
        statusEl.hidden = true;
        statusEl.textContent = "";
        statusEl.className = "update-status";
        statusEl.innerHTML = "";
        return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = "update-status " + tone;
}

function syncSidebarVersion() {
    const versionEl = document.getElementById("sidebarVersion");
    if (!versionEl) return;
    versionEl.textContent = "Version " + APP_VERSION;
}

function showUpdateAction(remoteVersion) {
    const statusEl = document.getElementById("updateStatus");
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className = "update-status yellow";
    statusEl.innerHTML = `
        <div class="update-copy">New version ${remoteVersion} available</div>
        <button class="update-action" type="button" onclick="reloadAppForUpdate()">Update now</button>
    `;
}

function reloadAppForUpdate() {
    location.reload();
}

async function checkForAppUpdate() {
    const currentVersion = APP_VERSION;
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("__versionCheck", String(Date.now()));

    try {
        const res = await fetch(currentUrl.toString(), { cache: "no-store" });
        if (!res.ok) return;

        const html = await res.text();
        const lines = html.split("\n");
        const metaLine = lines.find((line) => line.includes('name="app-version"'));
        const versionLine = metaLine || lines.find((line) => line.includes('class="sidebar-version"'));
        if (!versionLine) return;

        let remoteVersion = "";
        if (versionLine.includes('name="app-version"')) {
            const parts = versionLine.split('content="');
            remoteVersion = parts[1] ? parts[1].split('"')[0].trim() : "";
        } else {
            const parts = versionLine.split(">Version ");
            remoteVersion = parts[1] ? parts[1].split("<")[0].trim() : "";
        }

        if (!remoteVersion) return;
        if (compareVersions(remoteVersion, currentVersion) > 0) {
            showUpdateAction(remoteVersion);
        }
    } catch {
        return;
    }
}
function startUpdateWatcher() {
    checkForAppUpdate();
    if (updateCheckInterval) clearInterval(updateCheckInterval);
    updateCheckInterval = setInterval(checkForAppUpdate, VERSION_CHECK_INTERVAL);

    window.addEventListener("focus", checkForAppUpdate);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkForAppUpdate();
    });
}


function autoSaveToFile() {
    saveDB();
    lastExportTime = new Date();
    localStorage.setItem("lastAutoSaveTime", lastExportTime.toISOString());
    localStorage.setItem("lastExportTime", lastExportTime.toISOString());
    downloadBackup(getBackupFilename("team-yabee-auto-backup"), buildBackupData());
    updateBackupStatus();
    showSaveNotification("Auto-saved backup");
}

function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(autoSaveToFile, 60 * 60 * 1000);
}

let db = JSON.parse(localStorage.getItem("yabee_db")) || {pets:[]};
let lastExportTime = localStorage.getItem("lastExportTime") ? new Date(localStorage.getItem("lastExportTime")) : null;

function saveDB(){
    localStorage.setItem("yabee_db", JSON.stringify(db));
    localStorage.setItem("lastAutoSaveTime", new Date().toISOString());
    if (appReadyForSaveNotifications) showSaveNotification();
}

function uid(){
    return Date.now() + Math.random().toString(16).slice(2);
}

/** Local midnight ms for the calendar day in a display date (time-of-day ignored). */
function parseDisplayDateToLocalDayStartMs(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return 0;
    const trimmed = dateStr.trim();
    if (!trimmed || /^TBD$/i.test(trimmed)) return 0;

    let datePart = trimmed;
    if (trimmed.includes("·")) {
        datePart = trimmed.split(" · ")[0].trim();
    }

    const mdy = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
        const mm = parseInt(mdy[1], 10);
        const dd = parseInt(mdy[2], 10);
        const yyyy = parseInt(mdy[3], 10);
        if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yyyy >= 1900)
            return new Date(yyyy, mm - 1, dd).getTime();
    }

    if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(datePart)) {
        const [y, mo, da] = datePart.split(/[/-]/).map((n) => parseInt(n, 10));
        if (y && mo && da) return new Date(y, mo - 1, da).getTime();
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime()))
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();

    return 0;
}

/** Newest calendar day from service-relevant + all history dates (not clock time). */
function petSortDayEpochMs(p) {
    if (!p) return 0;
    let maxDay = 0;
    const consider = (s) => {
        const ms = parseDisplayDateToLocalDayStartMs(s || "");
        if (ms > maxDay) maxDay = ms;
    };
    consider(getLatestServiceTimestamp(p));
    if (Array.isArray(p.history)) {
        for (const h of p.history) consider(h?.date);
    }
    return maxDay;
}

function petIdFallbackNumber(p) {
    const m = String(p.id ?? "").match(/^\d+/);
    return m ? parseInt(m[0], 10) : 0;
}

function sortPetsNewestFirst(list) {
    return list.slice().sort((a, b) => {
        const da = petSortDayEpochMs(a);
        const db = petSortDayEpochMs(b);
        if (da !== db) return db - da;
        if (da === 0 && db === 0) {
            const ia = petIdFallbackNumber(a);
            const ib = petIdFallbackNumber(b);
            if (ia !== ib) return ib - ia;
        }
        const nameCmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
        if (nameCmp !== 0) return nameCmp;
        return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
    });
}

function getFullDateTime() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${month}/${day}/${year} · ${hours}:${minutes} ${ampm}`;
}

function formatDateTime(dateStr) {
    if (dateStr.includes("·")) return dateStr;
    if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split(/[/-]/);
        return `${month}/${day}/${year}`;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${month}/${day}/${year} · ${hours}:${minutes} ${ampm}`;
}

function getTodayDateLabel(){
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const year = now.getFullYear();
    return `${month}/${day}/${year}`;
}

function isToday(dateStr){
    if (!dateStr) return false;
    const today = getTodayDateLabel();
    if (dateStr.includes("·")) {
        const datePart = dateStr.split(" · ")[0].trim();
        return datePart === today;
    }
    if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split(/[/-]/);
        return `${month}/${day}/${year}` === today;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}` === today;
}

function getLatestServiceTimestamp(p){
    if (!p || !Array.isArray(p.history) || !p.history.length) return "";
    if (p.currentService === "Grooming") {
        for (let i = p.history.length - 1; i >= 0; i--) {
            const h = p.history[i];
            if (h?.service && String(h.service).startsWith("Grooming")) return h.date || "";
        }
        return p.history[p.history.length - 1]?.date || "";
    }
    if (p.currentService === "Hotel") {
        for (let i = p.history.length - 1; i >= 0; i--) {
            const h = p.history[i];
            if (h?.service === "Hotel Check-in") return h.date || "";
        }
        return p.history[p.history.length - 1]?.date || "";
    }
    return p.history[p.history.length - 1]?.date || "";
}

function formatBadgeTimestamp(ts){
    if (!ts) return "";
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const toLongDate = (mmddyyyy) => {
        const [mm, dd, yyyy] = (mmddyyyy || "").split("/").map(s => s.trim());
        const m = Number(mm);
        const d = Number(dd);
        const y = Number(yyyy);
        if (!m || !d || !y) return mmddyyyy || "";
        return `${monthNames[m - 1]} ${d}, ${y}`;
    };
    const keepAmPm = (timePart) => (timePart || "").trim();

    if (ts.includes("·")) {
        const [datePartRaw, timePartRaw] = ts.split(" · ").map(s => s.trim());
        const dateLong = toLongDate(datePartRaw);
        const timeWithMeridiem = keepAmPm(timePartRaw);
        if (timeWithMeridiem && dateLong) return `${timeWithMeridiem} · ${dateLong}`;
        return dateLong || timeWithMeridiem || "";
    }

    // plain date like YYYY-MM-DD or Date.parse-able
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
        const dateLong = `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        const h24 = d.getHours();
        const h12 = (h24 % 12) || 12;
        const m = String(d.getMinutes()).padStart(2, "0");
        return `${h12}:${m} · ${dateLong}`;
    }

    return formatDateTime(ts);
}

function isWithin24Hours(dateStr) {
    const entryDate = new Date(dateStr.includes("·") ? dateStr.split(" · ")[0] : dateStr);
    const now = new Date();
    const diffMs = now - entryDate;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 24;
}

function getCheckoutDateOnly(dateStr) {
    return dateStr || "TBD";
}

function getPackageOptions(selected = "") {
    return ["N/A","Sham-paw","Shorty Coat Paws","VIPAWS","Giant Poodles","Premium Wash","Premium Wash Cats","Catlux","Other"]
        .map(pkg => `<option ${selected === pkg ? "selected" : ""}>${pkg}</option>`)
        .join("");
}

function getModePetSnapshot(pets) {
    return pets.map(p => ({
        name:p.name,
        gender:p.gender,
        type:p.type,
        breed:p.breed,
        package:p.package
    }));
}

function formatMultiValue(pets, field, fallback = "N/A") {
    const values = pets.map(p => p[field]).filter(Boolean);
    return values.length ? values.join(", ") : fallback;
}

function formatPackageSummary(pets) {
    return pets.map(p => `${p.name}: ${p.package || "N/A"}`).join(", ");
}

function openBookingMode(service) {
    const isGrooming = service === "grooming";
    openModal(`
    <h2>${isGrooming ? "New Groom" : "Hotel Check-in"}</h2><br>
    <div class="mode-choice">
    <button class="mode-card" onclick="${isGrooming ? "openSingleGroom" : "openSingleHotel"}()">
    <span>Single Pet</span>
    </button>
    <button class="mode-card" onclick="${isGrooming ? "openMultiGroom" : "openMultiHotel"}()">
    <span>Multiple Pets</span>
    </button>
    </div>
    `);
}

function getMultiPetRow(service, index) {
    const rowId = `mpr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return `
    <div class="multi-pet-item" data-pet-row>
        <div class="multi-pet-top">
            <div class="form-group">
                <label>Name</label>
                <input data-field="name" placeholder="Pet name">
            </div>
            <div class="form-group">
                <label>${service === "hotel" ? "Check-out Package" : "Package"}</label>
                <select data-field="package">${getPackageOptions(service === "hotel" ? "" : "N/A")}</select>
            </div>
            <div class="multi-pet-actions">
                <button
                    class="mini-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-controls="${rowId}"
                    onclick="toggleMultiPetDetails(this)"
                >
                    Details
                </button>
                ${index > 0 ? `<button class="mini-remove" onclick="this.closest('[data-pet-row]').remove()" type="button" aria-label="Remove pet">X</button>` : ""}
            </div>
        </div>
        <div class="multi-pet-details" id="${rowId}" hidden>
            <div class="form-group">
                <label>Gender</label>
                <select data-field="gender"><option>Male</option><option>Female</option></select>
            </div>
            <div class="form-group">
                <label>Species</label>
                <select data-field="type"><option>Dog</option><option>Cat</option><option>Other</option></select>
            </div>
            <div class="form-group">
                <label>Breed</label>
                <input data-field="breed" placeholder="Breed">
            </div>
        </div>
    </div>`;
}

function addMultiPetRow(service) {
    const list = document.getElementById("multiPetsList");
    if (!list) return;
    list.insertAdjacentHTML("beforeend", getMultiPetRow(service, list.children.length));
}

function collectMultiPets() {
    return Array.from(document.querySelectorAll("[data-pet-row]")).map(row => ({
        name:row.querySelector('[data-field="name"]').value.trim() || "Unnamed",
        gender:row.querySelector('[data-field="gender"]')?.value || "N/A",
        type:row.querySelector('[data-field="type"]')?.value || "N/A",
        breed:row.querySelector('[data-field="breed"]')?.value.trim() || "N/A",
        package:row.querySelector('[data-field="package"]').value || "N/A"
    }));
}

function toggleMultiPetDetails(btn){
    const expanded = btn.getAttribute("aria-expanded") === "true";
    const id = btn.getAttribute("aria-controls");
    const panel = id ? document.getElementById(id) : null;
    btn.setAttribute("aria-expanded", String(!expanded));
    if (panel) panel.hidden = expanded;
}

/* Backup Status */
function updateBackupStatus() {
    const statusEl = document.getElementById("backupStatus");
    if (!lastExportTime) {
        statusEl.innerHTML = `<span class="time" style="color:#64748b;">No backup yet</span>`;
        statusEl.className = "backup-status";
        return;
    }
    const now = new Date();
    const diffMs = now - lastExportTime;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    let colorClass = "green";
    let text = `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffHours >= 24) colorClass = "red";
    else if (diffHours >= 4) colorClass = "yellow";
    statusEl.innerHTML = `Last backup: <span class="time">${text}</span>`;
    statusEl.className = `backup-status ${colorClass}`;
}

/* tabs */
document.querySelectorAll(".tab").forEach(btn=>{
btn.onclick=()=>{
document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
btn.classList.add("active");
document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
document.getElementById(btn.dataset.tab).classList.add("active");
};
});

modal.onclick=(e)=>{
if(e.target.id==="modal") modal.classList.remove("show");
};

function openModal(html){
modal.classList.add("show");
modalContent.innerHTML = html;
}

/* render functions (unchanged) */
function render(){
saveDB();
statPets.textContent = db.pets.length;
statGroom.textContent = db.pets.filter(p=>p.currentService==="Grooming").length;
statHotel.textContent = db.pets.filter(p=>p.currentService==="Hotel").length;
const groomTodayEl = document.getElementById("statGroomToday");
const hotelTodayEl = document.getElementById("statHotelToday");
if (groomTodayEl) groomTodayEl.textContent = db.pets.filter(p => p.currentService==="Grooming" && isToday(getLatestServiceTimestamp(p))).length;
if (hotelTodayEl) hotelTodayEl.textContent = db.pets.filter(p => p.currentService==="Hotel" && isToday(getLatestServiceTimestamp(p))).length;
renderPets();
renderGroom();
renderHotel();
updateBackupStatus();
}

function petCard(p){
const isMultiple = p.bookingMode === "multiple" && Array.isArray(p.bookingPets);
const petCount = isMultiple ? p.bookingPets.length : 1;
const multiTitle = isMultiple
    ? (() => {
        const names = p.bookingPets.map(x => x.name).filter(Boolean);
        if (!names.length) return "Unnamed";
        if (names.length <= 5) return names.join(", ");
        return `${names.slice(0,5).join(", ")} +${names.length - 5}`;
      })()
    : "";
const badgeTs = formatBadgeTimestamp(getLatestServiceTimestamp(p));
return `
<div class="pet" onclick="viewPet('${p.id}')" role="button" tabindex="0" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();viewPet('${p.id}');}">
<div>
<div class="pet-badge-row">
  <span class="service-badge ${p.currentService === "Hotel" ? "hotel-badge" : "groom-badge"}">${p.currentService || "None"}</span>
  ${badgeTs ? `<span class="service-time">${badgeTs}</span>` : ``}
</div>
<h3>${isMultiple ? multiTitle : p.name}</h3>
${isMultiple
    ? `<div class="muted">Multiple pets</div>`
    : `<div class="muted">${p.type} • ${p.breed}</div>`
}
<div class="tags">
${isMultiple ? `` : `<span class="tag">${p.gender}</span>`}
<span class="tag">${p.phone || "N/A"}</span>
${(!isMultiple && p.package) ? `<span class="tag">${p.package}</span>` : ""}
</div>
</div>
<div class="small-actions">
<button class="edit" onclick="event.stopPropagation(); editPet('${p.id}')">Edit</button>
<button class="delete" onclick="event.stopPropagation(); deletePet('${p.id}')">Delete</button>
</div>
</div>`;
}

function renderPets(){ 
let q = petSearch.value.toLowerCase().trim();
let arr = sortPetsNewestFirst(db.pets.filter(p => !q || [p.name, p.breed, p.gender, p.currentService || "", p.package || "", p.sharing || "", p.phone || ""].join(" ").toLowerCase().includes(q)));
petsList.innerHTML = arr.map(petCard).join("") || `<div class="empty">No pets found.</div>`;
}
function renderGroom(){
let q = groomSearch.value.toLowerCase().trim();
let arr = sortPetsNewestFirst(db.pets.filter(p => p.currentService === "Grooming" && (!q || [p.name, p.breed, p.gender, p.package || "", p.phone || ""].join(" ").toLowerCase().includes(q))));
groomList.innerHTML = arr.map(petCard).join("") || `<div class="empty">No grooming pets.</div>`;
}
function renderHotel(){
let q = hotelSearch.value.toLowerCase().trim();
let arr = sortPetsNewestFirst(db.pets.filter(p => p.currentService === "Hotel" && (!q || [p.name, p.breed, p.gender, p.sharing || "", p.package || "", p.phone || ""].join(" ").toLowerCase().includes(q))));
hotelList.innerHTML = arr.map(petCard).join("") || `<div class="empty">No hotel pets.</div>`;
}

function clearOldActivity(){
if(!confirm("Clear all activity older than 24 hours from Recent Activity?")) return;
db.pets.forEach(p => p.history = p.history.filter(h => isWithin24Hours(h.date)));
render();
alert("Old activity cleared successfully.");
}

/* View Pet - Removed separate Hotel Check-out section */
function viewPet(id){
let p = db.pets.find(x=>x.id==id);
if(!p) return;

let isGrooming = p.currentService === "Grooming";
let isMultiple = p.bookingMode === "multiple" && Array.isArray(p.bookingPets);
let multiTitle = isMultiple
    ? (() => {
        const names = p.bookingPets.map(x => x.name).filter(Boolean);
        if (!names.length) return "Unnamed";
        if (names.length <= 5) return names.join(", ");
        return `${names.slice(0,5).join(", ")} +${names.length - 5}`;
      })()
    : "";

let multiplePetsHTML = "";
if (isMultiple) {
    multiplePetsHTML = `
    <div class="card" style="margin-top:18px">
        <h3>PETS IN THIS BOOKING (${p.bookingPets.length})</h3>
        <div class="multi-pet-summary">
            ${p.bookingPets.map(bp => `
                <div class="multi-pet-summary-row">
                    <div class="multi-pet-summary-name"><b>${bp.name || "Unnamed"}</b></div>
                    <div class="muted">${[bp.type, bp.breed].filter(Boolean).join(" • ") || "N/A"}</div>
                    <div class="tags" style="margin-top:10px">
                        ${bp.gender ? `<span class="tag">${bp.gender}</span>` : ""}
                        ${bp.package ? `<span class="tag">${bp.package}</span>` : ""}
                    </div>
                </div>
            `).join("")}
        </div>
    </div>`;
}

let historyHTML = p.history.slice().reverse().map((h, index) => `
<div class="log">
<div class="log-time">${formatDateTime(h.date)}</div>
<div class="log-service">${h.service}</div>
${h.remarks ? `<div style="margin-top:8px;color:var(--muted);">Remarks: ${h.remarks}</div>` : ''}
<div class="log-actions">
<button class="log-edit" onclick="editHistoryEntry('${id}', ${p.history.length - 1 - index}); event.stopImmediatePropagation();">Edit</button>
<button class="log-delete" onclick="deleteHistoryEntry('${id}', ${p.history.length - 1 - index}); event.stopImmediatePropagation();">Delete</button>
</div>
</div>
`).join("");

openModal(`
<h2>${isMultiple ? multiTitle : p.name}</h2>
<p class="muted">${isMultiple ? `Multiple pets • ${p.bookingPets.length}` : `${p.type} • ${p.breed}`}</p><br>

<div class="grid">
${isMultiple ? "" : `<div class="card">Gender<br><b>${p.gender}</b></div>`}
<div class="card">Phone<br><b>${p.phone || "N/A"}</b></div>
<div class="card">Service<br><b>${p.currentService}</b></div>
${p.currentService === "Hotel" ? `<div class="card">Sharing<br><b>${p.sharing || "-"}</b></div>` : ``}
${(!isMultiple && p.package) ? `<div class="card">Package<br><b>${p.package}</b></div>` : ""}
</div>

<br>

${multiplePetsHTML}

<div class="accordion">
<div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('show')">
${isGrooming ? 'Add New Grooming Entry' : 'Add New Hotel Check-in + Check-out'}
<span style="font-size:18px;">▼</span>
</div>
<div class="accordion-content">
<div class="add-history-form">
${isGrooming ? `<select id="newPackage" style="background:#fff;"><option value="">Select Package</option><option>Sham-paw</option><option>Shorty Coat Paws</option><option>VIPAWS</option><option>Giant Poodles</option><option>Premium Wash</option><option>Premium Wash Cats</option><option>Catlux</option><option>Other</option></select>` : `
<label for="newCheckoutDate">Expected Check-out Date</label>
<input type="date" id="newCheckoutDate">
<label for="newCheckoutPackage">Check-out Package</label>
<select id="newCheckoutPackage" style="background:#fff;">
<option value="">Select Check-out Package</option>
<option>Sham-paw</option>
<option>Shorty Coat Paws</option>
<option>VIPAWS</option>
<option>Giant Poodles</option>
<option>Premium Wash</option>
<option>Premium Wash Cats</option>
<option>Catlux</option>
<option>Other</option>
</select>`}
<textarea id="newRemarks" placeholder="${isGrooming ? 'Write remarks here...' : 'Check-in remarks...'}"></textarea>
<button class="btn full" onclick="addHistoryEntry('${id}')">Add to History</button>
</div>
</div>
</div>

<br>

<div class="accordion">
<div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('show')">
History (${p.history.length} entries)
<span style="font-size:18px;">▼</span>
</div>
<div class="accordion-content show" id="historyContainer">
${historyHTML || '<div class="empty" style="margin:0;">No history yet.</div>'}
</div>
</div>
`);
}

/* Add History */
function addHistoryEntry(id){
let p = db.pets.find(x=>x.id==id);
if(!p) return;
let isGrooming = p.currentService === "Grooming";
let remarks = document.getElementById("newRemarks").value.trim();
if (isGrooming) {
    if (!remarks) { alert("Please write some remarks."); return; }
    p.history.push({ 
        date: getFullDateTime(), 
        service: "Grooming - " + (document.getElementById("newPackage")?.value || "Custom"), 
        remarks: remarks 
    });
} else {
    let checkoutDate = document.getElementById("newCheckoutDate").value;
    let checkoutPackage = document.getElementById("newCheckoutPackage").value || "No Package";
    if (!checkoutDate) { alert("Please choose an expected check-out date."); return; }

    p.history.push(
        {date: getFullDateTime(), service:"Hotel Check-in", remarks:remarks},
        {date: getCheckoutDateOnly(checkoutDate), service:`Hotel Check-out - ${checkoutPackage}`, remarks:"Expected check-out"}
    );
}

modal.classList.remove("show");
render();
alert(isGrooming ? "History entry added successfully." : "Hotel check-in and check-out added successfully.");
}

/* New Hotel Check-in with Expected Check-out */
function openHotel(){
openBookingMode("hotel");
}

function openSingleHotel(){
openModal(`
<h2>Hotel Check-in</h2><br>
<div class="form-grid">
<div class="form-group full"><label>Pet Name</label><input id="h1" placeholder="Enter pet name"></div>
<div class="form-group"><label>Owner Phone</label><input id="h2" placeholder="Phone number"></div>
<div class="form-group"><label>Gender</label><select id="h3"><option>Male</option><option>Female</option></select></div>
<div class="form-group"><label>Species</label><select id="h4"><option>Dog</option><option>Cat</option><option>Other</option></select></div>
<div class="form-group"><label>Breed</label><input id="h5" placeholder="Breed"></div>
<div class="form-group"><label>Expected Check-out Date</label><input type="date" id="hCheckoutDate"></div>
<div class="form-group"><label>Check-out Package</label>
<select id="hCheckoutPackage">
<option value="">Select Package</option>
<option>Sham-paw</option>
<option>Shorty Coat Paws</option>
<option>VIPAWS</option>
<option>Giant Poodles</option>
<option>Premium Wash</option>
<option>Premium Wash Cats</option>
<option>Catlux</option>
<option>Other</option>
</select>
</div>
<div class="form-group full"><label>Remarks (Check-in)</label><textarea id="h6" placeholder="Any special notes..."></textarea></div>
<button class="btn full" onclick="saveHotel()">Save Check-in</button>
</div>
`);
}

function saveHotel(){
let checkoutDate = document.getElementById("hCheckoutDate").value;
let checkoutPackage = document.getElementById("hCheckoutPackage").value || "No Package";
let remarks = document.getElementById("h6").value.trim();
let singlePet = {
    name:h1.value || "Unnamed",
    gender:h3.value,
    type:h4.value,
    package:checkoutPackage
};

const checkInTime = getFullDateTime();

db.pets.push({
id:uid(),
name:singlePet.name,
phone:h2.value || "N/A",
gender:singlePet.gender,
type:singlePet.type,
breed:h5.value || "N/A",
package:checkoutPackage,
remarks:remarks,
sharing:"",
currentService:"Hotel",
bookingMode:"single",
bookingPet:singlePet,
history:[
    {date: checkInTime, service:"Hotel Check-in", remarks:remarks},
    {date: getCheckoutDateOnly(checkoutDate), service:`Hotel Check-out - ${checkoutPackage}`, remarks:"Expected check-out"}
]
});

modal.classList.remove("show");
render();
alert("Hotel check-in saved with expected check-out!");
}

function openMultiHotel(){
openModal(`
<h2>Hotel Check-in</h2><br>
<div class="form-grid">
<div class="form-group full"><label>Owner Phone</label><input id="mhPhone" placeholder="Phone number"></div>
<div class="form-group full"><label>Expected Check-out Date</label><input type="date" id="mhCheckoutDate"></div>
<div class="form-group full"><label>Remarks (Check-in)</label><textarea id="mhRemarks" placeholder="Any special notes..."></textarea></div>
<div class="full multi-section">
<div class="multi-section-head">
<h3>Pets</h3>
<button class="btn light" onclick="addMultiPetRow('hotel')" type="button">+ Add Pet</button>
</div>
<div id="multiPetsList" class="multi-pets-list">
${getMultiPetRow("hotel", 0)}
</div>
</div>
<button class="btn full" onclick="saveMultiHotel()">Save Check-in</button>
</div>
`);
}

function saveMultiHotel(){
let pets = collectMultiPets();
let checkoutDate = document.getElementById("mhCheckoutDate").value;
let remarks = document.getElementById("mhRemarks").value.trim();
if (!checkoutDate) { alert("Please choose an expected check-out date."); return; }
if (!pets.length) { alert("Please add at least one pet."); return; }

const groupId = uid();
const bookingPets = getModePetSnapshot(pets);
const checkInTime = getFullDateTime();

db.pets.push({
id:uid(),
name:formatMultiValue(pets, "name", "Unnamed"),
phone:mhPhone.value || "N/A",
gender:formatMultiValue(pets, "gender"),
type:formatMultiValue(pets, "type"),
breed:formatMultiValue(pets, "breed"),
package:formatPackageSummary(pets),
remarks:remarks,
sharing:"",
currentService:"Hotel",
bookingMode:"multiple",
bookingGroupId:groupId,
bookingPets:bookingPets,
history:[
    {date: checkInTime, service:"Hotel Check-in", remarks:remarks},
    {date: getCheckoutDateOnly(checkoutDate), service:`Hotel Check-out - ${formatPackageSummary(pets)}`, remarks:"Expected check-out"}
]
});

modal.classList.remove("show");
render();
alert("Multiple hotel pets checked in successfully.");
}

/* Rest of the functions (Edit Pet, New Groom, etc.) remain the same */
function editPet(id){
let p = db.pets.find(x=>x.id==id);
if(!p) return;
if (p.bookingMode === "multiple" && Array.isArray(p.bookingPets)) {
    openEditMultiPet(id);
    return;
}
let isGrooming = p.currentService === "Grooming";

openModal(`
<h2>Edit Pet</h2><br>
<div class="form-grid">
<div class="form-group full"><label>Pet Name</label><input id="e1" value="${p.name}"></div>
<div class="form-group"><label>Owner Phone</label><input id="e2" value="${p.phone || ""}"></div>
<div class="form-group"><label>Gender</label><select id="e3"><option ${p.gender==="Male"?"selected":""}>Male</option><option ${p.gender==="Female"?"selected":""}>Female</option></select></div>
<div class="form-group"><label>Species</label><select id="e4"><option ${p.type==="Dog"?"selected":""}>Dog</option><option ${p.type==="Cat"?"selected":""}>Cat</option><option ${p.type==="Other"?"selected":""}>Other</option></select></div>
<div class="form-group"><label>Breed</label><input id="e5" value="${p.breed || ""}"></div>

${isGrooming ? `
<div class="form-group full">
<label>Package</label>
<select id="ePackage">
<option value="">None</option>
<option ${p.package==="Sham-paw"?"selected":""}>Sham-paw</option>
<option ${p.package==="Shorty Coat Paws"?"selected":""}>Shorty Coat Paws</option>
<option ${p.package==="VIPAWS"?"selected":""}>VIPAWS</option>
<option ${p.package==="Giant Poodles"?"selected":""}>Giant Poodles</option>
<option ${p.package==="Premium Wash"?"selected":""}>Premium Wash</option>
<option ${p.package==="Premium Wash Cats"?"selected":""}>Premium Wash Cats</option>
<option ${p.package==="Catlux"?"selected":""}>Catlux</option>
<option ${p.package && !["Sham-paw","Shorty Coat Paws","VIPAWS","Giant Poodles","Premium Wash","Premium Wash Cats","Catlux"].includes(p.package) ? "selected" : ""}>Other</option>
</select>
</div>` : ''}

<div class="form-group full"><label>Remarks</label><textarea id="e6">${p.remarks||""}</textarea></div>

<button class="btn full" onclick="saveEdit('${id}')">Save Changes</button>
</div>
`);
}

function getMultiPetEditRow(service, index, pet, expanded = true){
    const rowId = `mper_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const safe = (v, fallback = "") => (v === undefined || v === null ? fallback : String(v));
    const genders = ["Male","Female"];
    const species = ["Dog","Cat","Other"];
    return `
    <div class="multi-pet-item" data-pet-row>
        <div class="multi-pet-top">
            <div class="form-group">
                <label>Name</label>
                <input data-field="name" placeholder="Pet name" value="${safe(pet?.name)}">
            </div>
            <div class="form-group">
                <label>${service === "hotel" ? "Check-out Package" : "Package"}</label>
                <select data-field="package">${getPackageOptions(service === "hotel" ? "" : "N/A")}</select>
            </div>
            <div class="multi-pet-actions">
                <button
                    class="mini-toggle"
                    type="button"
                    aria-expanded="${expanded ? "true" : "false"}"
                    aria-controls="${rowId}"
                    onclick="toggleMultiPetDetails(this)"
                >
                    Details
                </button>
                ${index > 0 ? `<button class="mini-remove" onclick="this.closest('[data-pet-row]').remove()" type="button" aria-label="Remove pet">X</button>` : ""}
            </div>
        </div>
        <div class="multi-pet-details" id="${rowId}" ${expanded ? "" : "hidden"}>
            <div class="form-group">
                <label>Gender</label>
                <select data-field="gender">
                    ${genders.map(g => `<option ${safe(pet?.gender)==g ? "selected" : ""}>${g}</option>`).join("")}
                </select>
            </div>
            <div class="form-group">
                <label>Species</label>
                <select data-field="type">
                    ${species.map(s => `<option ${safe(pet?.type)==s ? "selected" : ""}>${s}</option>`).join("")}
                </select>
            </div>
            <div class="form-group">
                <label>Breed</label>
                <input data-field="breed" placeholder="Breed" value="${safe(pet?.breed)}">
            </div>
        </div>
    </div>`;
}

function openEditMultiPet(id){
    const p = db.pets.find(x=>x.id==id);
    if(!p) return;
    const service = p.currentService === "Hotel" ? "hotel" : "grooming";
    const pets = Array.isArray(p.bookingPets) ? p.bookingPets : [];

    openModal(`
    <h2>Edit Multiple Pets</h2><br>
    <div class="form-grid">
        <div class="form-group full"><label>Owner Phone</label><input id="emPhone" value="${p.phone || ""}"></div>
        <div class="form-group full"><label>Remarks</label><textarea id="emRemarks" placeholder="Any special notes...">${p.remarks || ""}</textarea></div>

        <div class="full multi-section">
            <div class="multi-section-head">
                <h3>Pets</h3>
                <button class="btn light" type="button" onclick="addEditMultiPetRow('${service}')">+ Add Pet</button>
            </div>
            <div id="editMultiPetsList" class="multi-pets-list">
                ${(pets.length ? pets : [{name:"",gender:"Male",type:"Dog",breed:"",package: (service==="hotel" ? "" : "N/A")}]).map((pet, idx) => getMultiPetEditRow(service, idx, pet, true)).join("")}
            </div>
        </div>

        <button class="btn full" onclick="saveEditMulti('${id}')">Save Changes</button>
    </div>
    `);

    // Set selected package values after DOM is in place
    setTimeout(() => {
        const rows = Array.from(document.querySelectorAll("#editMultiPetsList [data-pet-row]"));
        rows.forEach((row, idx) => {
            const pet = (pets.length ? pets : [{ }])[idx] || {};
            const sel = row.querySelector('[data-field="package"]');
            if (sel && pet.package) sel.value = pet.package;
        });
    }, 0);
}

function addEditMultiPetRow(service){
    const list = document.getElementById("editMultiPetsList");
    if (!list) return;
    list.insertAdjacentHTML("beforeend", getMultiPetEditRow(service, list.children.length, {name:"",gender:"Male",type:"Dog",breed:"",package:(service==="hotel"?"":"N/A")}, true));
}

function saveEditMulti(id){
    const p = db.pets.find(x=>x.id==id);
    if(!p) return;

    const pets = collectMultiPets();
    if (!pets.length) { alert("Please add at least one pet."); return; }

    p.phone = document.getElementById("emPhone")?.value || "N/A";
    p.remarks = document.getElementById("emRemarks")?.value || "";
    if (p.currentService === "Hotel") p.sharing = "";

    // Persist structured pets for proper editing & rendering
    p.bookingPets = getModePetSnapshot(pets);

    // Keep aggregated fields in sync (used by search + legacy display)
    p.name = formatMultiValue(pets, "name", "Unnamed");
    p.gender = formatMultiValue(pets, "gender");
    p.type = formatMultiValue(pets, "type");
    p.breed = formatMultiValue(pets, "breed");
    p.package = formatPackageSummary(pets);

    modal.classList.remove("show");
    render();
}

function saveEdit(id){
let p = db.pets.find(x=>x.id==id);
if(!p) return;
p.name = e1.value || "Unnamed";
p.phone = e2.value || "N/A";
p.gender = e3.value;
p.type = e4.value;
p.breed = e5.value || "N/A";
if (p.currentService === "Grooming" && document.getElementById("ePackage")) {
    p.package = document.getElementById("ePackage").value || "";
}
p.remarks = e6.value;
modal.classList.remove("show"); 
render();
}

function deletePet(id){
if(!confirm("Delete this pet permanently?")) return;
db.pets = db.pets.filter(x=>x.id!=id);
render();
}

function editHistoryEntry(petId, historyIndex){
let p = db.pets.find(x=>x.id==petId);
if(!p) return;
let h = p.history[historyIndex];
let isGrooming = p.currentService === "Grooming";
let isHotelCheckout = h.service.includes("Hotel Check-out");

openModal(`
<h2>Edit History Entry</h2><br>
<div class="add-history-form">
${isGrooming || isHotelCheckout ? `
<select id="editPackage" style="background:#fff;">
<option value="">Select Package</option>
<option ${h.service.includes("Sham-paw") ? "selected" : ""}>Sham-paw</option>
<option ${h.service.includes("Shorty Coat Paws") ? "selected" : ""}>Shorty Coat Paws</option>
<option ${h.service.includes("VIPAWS") ? "selected" : ""}>VIPAWS</option>
<option ${h.service.includes("Giant Poodles") ? "selected" : ""}>Giant Poodles</option>
<option ${h.service.includes("Premium Wash") ? "selected" : ""}>Premium Wash</option>
<option ${h.service.includes("Premium Wash Cats") ? "selected" : ""}>Premium Wash Cats</option>
<option ${h.service.includes("Catlux") ? "selected" : ""}>Catlux</option>
<option ${!h.service.includes("-") ? "selected" : ""}>Other</option>
</select>` : `<input id="editService" value="${h.service}" class="full" readonly>`}
<textarea id="editRemarks" class="full">${h.remarks || ""}</textarea>
<button class="btn full" onclick="saveHistoryEdit('${petId}', ${historyIndex})">Save Changes</button>
</div>
`);
}

function saveHistoryEdit(petId, historyIndex){
let p = db.pets.find(x=>x.id==petId);
if(p){
    let h = p.history[historyIndex];
    let isGrooming = p.currentService === "Grooming";
    let isHotelCheckout = h.service.includes("Hotel Check-out");
    if (isGrooming || isHotelCheckout) {
        let selectedPackage = document.getElementById("editPackage").value || "No Package";
        let baseText = isGrooming ? "Grooming - " : "Hotel Check-out - ";
        h.service = baseText + selectedPackage;
    }
    h.remarks = document.getElementById("editRemarks").value.trim();
}
modal.classList.remove("show");
render();
setTimeout(() => viewPet(petId), 10);
}

function deleteHistoryEntry(petId, historyIndex){
if(!confirm("Delete this history entry?")) return;
let p = db.pets.find(x=>x.id==petId);
if(p){
    p.history.splice(historyIndex, 1);
    modal.classList.remove("show");
    render();
    setTimeout(() => viewPet(petId), 10);
}
}

/* New Groom */
function openGroom(){
openBookingMode("grooming");
}

function openSingleGroom(){
openModal(`
<h2>New Groom</h2><br>
<div class="form-grid">
<div class="form-group full"><label>Pet Name</label><input id="g1" placeholder="Enter pet name"></div>
<div class="form-group"><label>Owner Phone</label><input id="g2" placeholder="Phone number"></div>
<div class="form-group"><label>Gender</label><select id="g3"><option>Male</option><option>Female</option></select></div>
<div class="form-group"><label>Species</label><select id="g4"><option>Dog</option><option>Cat</option><option>Other</option></select></div>
<div class="form-group"><label>Breed</label><input id="g5" placeholder="Breed"></div>
<div class="form-group full"><label>Package</label><select id="g6">
<option>N/A</option>
<option>Sham-paw</option>
<option>Shorty Coat Paws</option>
<option>VIPAWS</option>
<option>Giant Poodles</option>
<option>Premium Wash</option>
<option>Premium Wash Cats</option>
<option>Catlux</option>
</select></div>
<div class="form-group full"><label>Remarks</label><textarea id="g7" placeholder="Any special notes..."></textarea></div>
<button class="btn full" onclick="saveGroom()">Save Grooming</button>
</div>
`);
}

function saveGroom(){
let singlePet = {
    name:g1.value || "Unnamed",
    gender:g3.value,
    type:g4.value,
    package:g6.value
};
db.pets.push({
id:uid(),
name:singlePet.name,
phone:g2.value || "N/A",
gender:singlePet.gender,
type:singlePet.type,
breed:g5.value || "N/A",
package:singlePet.package,
remarks:g7.value,
sharing:"",
currentService:"Grooming",
bookingMode:"single",
bookingPet:singlePet,
history:[{date: getFullDateTime(), service:"Grooming - "+singlePet.package, remarks:g7.value}]
});
modal.classList.remove("show");
render();
}

function openMultiGroom(){
openModal(`
<h2>New Groom</h2><br>
<div class="form-grid">
<div class="form-group full"><label>Owner Phone</label><input id="mgPhone" placeholder="Phone number"></div>
<div class="form-group full"><label>Remarks</label><textarea id="mgRemarks" placeholder="Any special notes..."></textarea></div>
<div class="full multi-section">
<div class="multi-section-head">
<h3>Pets</h3>
<button class="btn light" onclick="addMultiPetRow('grooming')" type="button">+ Add Pet</button>
</div>
<div id="multiPetsList" class="multi-pets-list">
${getMultiPetRow("grooming", 0)}
</div>
</div>
<button class="btn full" onclick="saveMultiGroom()">Save Grooming</button>
</div>
`);
}

function saveMultiGroom(){
let pets = collectMultiPets();
let remarks = document.getElementById("mgRemarks").value.trim();
if (!pets.length) { alert("Please add at least one pet."); return; }

const groupId = uid();
const bookingPets = getModePetSnapshot(pets);

db.pets.push({
id:uid(),
name:formatMultiValue(pets, "name", "Unnamed"),
phone:mgPhone.value || "N/A",
gender:formatMultiValue(pets, "gender"),
type:formatMultiValue(pets, "type"),
breed:formatMultiValue(pets, "breed"),
package:formatPackageSummary(pets),
remarks:remarks,
sharing:"",
currentService:"Grooming",
bookingMode:"multiple",
bookingGroupId:groupId,
bookingPets:bookingPets,
history:[{date: getFullDateTime(), service:"Grooming - "+formatPackageSummary(pets), remarks:remarks}]
});

modal.classList.remove("show");
render();
alert("Multiple grooming pets saved successfully.");
}

/* Backup import/export */
function exportData(){
    saveDB();
    downloadBackup(getBackupFilename("team-yabee-backup"), buildBackupData());

    lastExportTime = new Date();
    localStorage.setItem("lastExportTime", lastExportTime.toISOString());
    updateBackupStatus();
    showSaveNotification("Backup exported");
}

importFile.onchange = function(){
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const imported = JSON.parse(e.target.result);
            delete imported.backupCreated;
            delete imported.exportedAt;
            delete imported.note;

            if (!imported || !Array.isArray(imported.pets)) {
                throw new Error("Backup file is missing pets data.");
            }

            db = imported;
            saveDB();
            render();
            alert("Imported successfully.");
        }
        catch {
            alert("Invalid backup file.");
        }
        finally {
            importFile.value = "";
        }
    };
    reader.readAsText(file);
};

petSearch.oninput = renderPets;
groomSearch.oninput = renderGroom;
hotelSearch.oninput = renderHotel;

startUpdateWatcher();
startAutoSave();
syncSidebarVersion();
render();
updateBackupStatus();
appReadyForSaveNotifications = true;

/* ===========================================================
   ELS Front — thème unique / calendrier continu 15 min
   Aucune dépendance externe. Compatible Apps Script WebApp.
   =========================================================== */

// ----- Config front (modifiable sans rebuild) -----
const UI_CONFIG = {
  STEP_MIN: 15,
  START_TIME: "07:00",
  END_TIME: "21:00",
  WEEK_START: 1, // 1 = Lundi
};

// TARIFS par défaut (peuvent être écrasés par le serveur)
window.TARIFS = window.TARIFS || {
  baseCourse: 15,               // 1 retrait + 1 PDL, 9km, 30min
  baseKm: 9,
  baseMin: 30,
  surcUrgence: 20,              // exemples visuels
  surcSamedi: 25,
  PDL_PRIX: [5,4,3,4,5],
  PDL_PRIX_FALLBACK: 5
};

// ----- Helpers date/heure -----
function toMinutes(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
function pad2(n){ return String(n).padStart(2,"0"); }
function minutesRange(start,end,step){
  const out=[]; for(let t=toMinutes(start); t<=toMinutes(end); t+=step){
    out.push(pad2(Math.floor(t/60))+":"+pad2(t%60));
  } return out;
}
function startOfWeek(date, weekStart=1){
  const d = new Date(date);
  const day = (d.getDay()+6)%7; // 0 (Mon) .. 6 (Sun)
  const diff = day - (weekStart-1);
  d.setDate(d.getDate() - diff);
  d.setHours(0,0,0,0);
  return d;
}
function addDays(date, days){ const d=new Date(date); d.setDate(d.getDate()+days); return d; }
function fmtDate(d){ return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`; }
function isoDate(d){ return d.toISOString().slice(0,10); }

// ----- État global -----
let baseDate = new Date(); // ancrage semaine courante
let times = [];
let selected = []; // [{dateISO,time}]
let busyMap = new Map(); // key = dateISO → Set("HH:MM")
let proxyInfo = null;

// ----- Toast -----
function showToast(msg, timeout=2500){
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  setTimeout(()=>{ el.hidden=true; el.textContent=""; }, timeout);
}

// ----- Rendu semaine (barre titres) -----
function renderWeekbar(weekStartDate){
  const weekbar = document.getElementById("weekbar");
  for(let i=0;i<7;i++){
    const cell = weekbar.querySelector(`.day[data-day="${i}"]`);
    const d = addDays(weekStartDate, i);
    cell.textContent = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][i] + " " + fmtDate(d);
    cell.setAttribute("data-date", isoDate(d));
  }
}

// ----- Rendu grille -----
function renderGrid(weekStartDate){
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";

  // 1) colonne des heures
  const timeCol = document.createElement("div");
  timeCol.className = "timecol";
  timeCol.innerHTML = times.map(t=>`<div class="slot" aria-hidden="true">${t}</div>`).join("");
  grid.appendChild(timeCol);

  // 2) 7 colonnes jours
  for(let dayIndex=0; dayIndex<7; dayIndex++){
    const col = document.createElement("div");
    const date = addDays(weekStartDate, dayIndex);
    const dateISO = isoDate(date);
    const busySet = busyMap.get(dateISO) || new Set();

    times.forEach(t=>{
      const cell = document.createElement("div");
      cell.className = "slot";
      if(busySet.has(t)) cell.setAttribute("data-state","busy");

      const btn = document.createElement("button");
      btn.type="button";
      btn.setAttribute("aria-label", `Réserver ${t}`);
      btn.textContent = t;

      const isSel = selected.some(s=>s.dateISO===dateISO && s.time===t);
      if(isSel) cell.setAttribute("data-selected","true");

      btn.addEventListener("click", ()=>{
        onSlotClick({ dateISO, dayIndex, time: t, busy: busySet.has(t) });
      });

      cell.appendChild(btn);
      col.appendChild(cell);
    });

    grid.appendChild(col);
  }
}

// ----- Sélection de créneau -----
function onSlotClick({dateISO, dayIndex, time, busy}){
  if(busy){ showToast("Ce créneau est déjà pris."); return; }

  const idx = selected.findIndex(s=>s.dateISO===dateISO && s.time===time);
  if(idx>=0){
    selected.splice(idx,1); // toggle off
  }else{
    selected.push({dateISO, time});
  }
  renderCart();
  // mise à jour visuelle rapide sans tout rerendre
  const grid = document.getElementById("cal-grid");
  const dayCol = grid.children[dayIndex+1]; // +1 à cause de la timecol
  const timeIdx = times.indexOf(time);
  const cell = dayCol.children[timeIdx];
  const isSelected = cell.getAttribute("data-selected")==="true";
  cell.setAttribute("data-selected", isSelected ? "false" : "true");
  if(isSelected) cell.removeAttribute("data-selected");
}

// ----- Panier -----
function renderCart(){
  const list = document.getElementById("cart-list");
  const empty = document.getElementById("cart-empty");
  const totalEl = document.getElementById("cart-total");

  list.innerHTML = "";
  if(selected.length===0){
    empty.hidden = false;
    totalEl.textContent = "0,00 €";
    return;
  }
  empty.hidden = true;

  const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const weekStart = startOfWeek(baseDate, UI_CONFIG.WEEK_START);
  selected
    .slice()
    .sort((a,b)=> (a.dateISO+a.time).localeCompare(b.dateISO+b.time))
    .forEach((it, i)=>{
      const d = new Date(it.dateISO+"T00:00:00");
      const dayIndex = Math.round((d - weekStart)/(24*3600*1000));
      const li = document.createElement("li");
      li.className = "cart-item";
      li.innerHTML = `
        <span>${days[dayIndex] || it.dateISO} • ${it.time}</span>
        <button class="btn ghost" aria-label="Retirer" type="button">Retirer</button>
      `;
      li.querySelector("button").addEventListener("click",()=>{
        selected.splice(i,1); renderCart();
        // aussi nettoyer marquage visuel si visible
        const grid = document.getElementById("cal-grid");
        const dayCol = grid.children[dayIndex+1];
        const idx = times.indexOf(it.time);
        const cell = dayCol?.children?.[idx];
        if(cell) cell.removeAttribute("data-selected");
      });
      list.appendChild(li);
    });

  // Calcul total (estimation côté front)
  const total = computePrice(selected);
  totalEl.textContent = total.toFixed(2).replace(".", ",") + " €";
}

// ----- Calcul de prix (simple — remplaçable par le serveur) -----
function computePrice(items){
  if(items.length===0) return 0;
  const T = window.TARIFS || {};
  const base = Number(T.baseCourse ?? 15);
  // Arrêts sup. = nombre de créneaux - 1 (le premier inclus)
  const extra = Math.max(0, items.length - 1);
  let extraSum = 0;
  for(let i=0;i<extra;i++){
    extraSum += (T.PDL_PRIX?.[i] ?? T.PDL_PRIX_FALLBACK ?? 5);
  }
  // Exemple : si un créneau tombe un samedi, appliquer surcSamedi (au moins une fois)
  const hasSaturday = items.some(it => new Date(it.dateISO).getDay()===6);
  const samedi = hasSaturday ? Number(T.surcSamedi ?? 0) : 0;

  return base + extraSum + samedi;
}

// ----- Chargement des créneaux occupés (peut appeler Apps Script) -----
function loadBusyForWeek(weekStartDate){
  busyMap.clear();

  // Si Apps Script est dispo, on appelle le backend
  if(window.google && google.script && google.script.run){
    const iso = isoDate(weekStartDate);
    google.script.run
      .withSuccessHandler((data)=>{
        // data attendu: [{dateISO:"2025-09-06", times:["07:00","07:15",...]}]
        (data||[]).forEach(d=>{
          busyMap.set(d.dateISO, new Set(d.times||[]));
        });
        renderGrid(weekStartDate);
      })
      .withFailureHandler(()=>{ renderGrid(weekStartDate); })
      .getBusySlotsForWeek(iso); // à implémenter côté serveur
    return;
  }

  // Fallback démo côté client (simule quelques slots pris)
  for(let i=0;i<7;i++){
    const dateISO = isoDate(addDays(weekStartDate,i));
    const set = new Set();
    // Exemple: bloquer 10:00 et 10:15 les jours pairs
    if(i%2===0){ set.add("10:00"); set.add("10:15"); }
    busyMap.set(dateISO,set);
  }
  renderGrid(weekStartDate);
}

// ----- Navigation semaine -----
function renderWeek(){
  const weekStart = startOfWeek(baseDate, UI_CONFIG.WEEK_START);
  renderWeekbar(weekStart);
  times = minutesRange(UI_CONFIG.START_TIME, UI_CONFIG.END_TIME, UI_CONFIG.STEP_MIN);
  loadBusyForWeek(weekStart);
}

function nextWeek(){ baseDate = addDays(baseDate, 7); renderWeek(); }
function prevWeek(){ baseDate = addDays(baseDate,-7); renderWeek(); }

// ----- Modale déclenchement par tiers -----
function initProxyDialog(){
  const dlg = document.getElementById("dlg-proxy");
  const btnOpeners = document.querySelectorAll('[data-open="dlg-proxy"]');
  const btnClosers = dlg.querySelectorAll("[data-close]");
  const chkBilling = document.getElementById("chk-billing");
  const billingFields = document.getElementById("billing-fields");
  const form = document.getElementById("frm-proxy");

  btnOpeners.forEach(b=>b.addEventListener("click",()=>openDialog(dlg)));
  btnClosers.forEach(b=>b.addEventListener("click",()=>closeDialog(dlg)));
  chkBilling.addEventListener("change",()=>{ billingFields.hidden = !chkBilling.checked; });

  form.addEventListener("submit",(ev)=>{
    ev.preventDefault();
    const fd = new FormData(form);
    proxyInfo = {
      residentName: fd.get("residentName") || "",
      org: fd.get("org") || "",
      phone: fd.get("phone") || "",
      email: fd.get("email") || "",
      billing: chkBilling.checked ? {
        name: fd.get("billingName") || "",
        email: fd.get("billingEmail") || "",
        ref: fd.get("billingRef") || ""
      } : null
    };
    closeDialog(dlg);
    showToast("Coordonnées enregistrées.");
  });
}

// ----- Actions panier -----
function initCartActions(){
  document.getElementById("btn-vider").addEventListener("click",()=>{
    selected.length = 0; renderCart(); renderWeek();
  });

  document.getElementById("btn-valider").addEventListener("click",()=>{
    if(selected.length===0){ showToast("Ajoutez au moins un créneau."); return; }

    const payload = { slots: selected.slice(), proxyInfo };
    // Appel serveur si dispo
    if(window.google && google.script && google.script.run){
      document.getElementById("btn-valider").disabled = true;
      google.script.run
        .withSuccessHandler((res)=>{
          document.getElementById("btn-valider").disabled = false;
          // res: {ok:true, conflicts:[{dateISO,time}]}
          if(res?.conflicts?.length){
            showToast("Certains créneaux viennent d’être pris.");
            res.conflicts.forEach(c=>{
              const set = busyMap.get(c.dateISO) || new Set();
              set.add(c.time); busyMap.set(c.dateISO,set);
              // retirer du panier si présent
              const idx = selected.findIndex(s=>s.dateISO===c.dateISO && s.time===c.time);
              if(idx>=0) selected.splice(idx,1);
            });
            renderCart(); renderWeek();
          }else{
            showToast("Réservation enregistrée.");
            selected.length = 0; renderCart(); renderWeek();
          }
        })
        .withFailureHandler((err)=>{
          document.getElementById("btn-valider").disabled = false;
          console.error(err); showToast("Erreur réseau. Réessayez.");
        })
        .createBooking(payload); // à implémenter côté serveur
      return;
    }

    // Fallback local
    showToast("Réservation (démo) enregistrée.");
    selected.length=0; renderCart(); renderWeek();
  });
}

// ----- Bootstrap -----
document.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("prev-week").addEventListener("click", prevWeek);
  document.getElementById("next-week").addEventListener("click", nextWeek);
  initProxyDialog();
  initCartActions();
  renderWeek();
});

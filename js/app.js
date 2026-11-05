/**
 * Alternance BFC — suivi des candidatures d'alternance en Bourgogne-Franche-Comté.
 *
 * Application 100 % front-end (HTML / CSS / JavaScript, sans framework ni dépendance).
 * Les données sont enregistrées dans le navigateur avec localStorage.
 *
 * Organisation du fichier :
 *   1. Constantes et état
 *   2. Stockage (localStorage)
 *   3. Utilitaires
 *   4. Opérations sur les données (ajout, modification, suppression)
 *   5. Affichage (tableau, compteurs, panneau « À faire »)
 *   6. Événements (filtres, édition, boutons)
 *   7. Export / import CSV
 *   8. Démarrage
 */
(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // 1. Constantes et état
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = "alternance-bfc:v1";

  const DEPS = [
    ["21", "Côte-d'Or"], ["25", "Doubs"], ["39", "Jura"], ["58", "Nièvre"],
    ["70", "Haute-Saône"], ["71", "Saône-et-Loire"], ["89", "Yonne"], ["90", "Territoire de Belfort"],
  ];
  const STATUTS = ["À contacter", "Candidature envoyée", "Relance faite", "Entretien", "Accepté", "Refus"];
  const METIERS = ["Développement", "Admin sys / réseau", "Cybersécurité"];
  const TYPES = ["ESN / conseil", "Éditeur / startup", "Industrie", "Banque / assurance", "Public / collectivité", "Autre"];
  const RELANCE_APRES_ENVOI = 10;   // jours
  const RELANCE_SUIVANTE = 7;       // jours

  // Colonnes du tableau (k = champ de la donnée)
  const COLS = [
    { k: "nom", label: "Entreprise", w: "190px" },
    { k: "ville", label: "Ville", w: "130px" },
    { k: "dep", label: "Dép.", w: "64px" },
    { k: "metier", label: "Métier", w: "175px" },
    { k: "type", label: "Type", w: "150px" },
    { k: "technos", label: "Technos", w: "190px" },
    { k: "priorite", label: "Priorité", w: "100px" },
    { k: "statut", label: "Statut", w: "170px" },
    { k: "dateCandidature", label: "Envoyée le", w: "140px" },
    { k: "dateRelance", label: "Relance le", w: "140px" },
    { k: "contact", label: "Contact", w: "170px" },
    { k: "notes", label: "Notes", w: "240px" },
    { k: "_act", label: "", w: "150px", nosort: true },
  ];

  // Colonnes de l'export CSV (dans l'ordre)
  const CSV_COLS = [
    ["Entreprise", "nom"], ["Ville", "ville"], ["Département", "dep"], ["Métier", "metier"], ["Type", "type"],
    ["Technos", "technos"], ["Priorité", "priorite"], ["Statut", "statut"],
    ["Date candidature", "dateCandidature"], ["Date relance", "dateRelance"],
    ["Contact", "contact"], ["Lien", "lien"], ["Notes", "notes"], ["Source", "source"],
  ];

  const state = {
    rows: [],                                   // toutes les entreprises
    sort: { k: "nom", dir: 1 },                 // tri courant (1 = croissant)
    filters: { q: "", dep: "", statut: "", type: "", metier: "" },
    confirmId: null,                            // ligne en attente de confirmation de suppression
    renderPending: false,                       // un rendu attend la fin d'une saisie
    resetArmed: false,
  };

  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------------
  // 2. Stockage
  // ---------------------------------------------------------------------------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      banner("Impossible de lire les données enregistrées : la liste de départ est affichée.", true);
    }
    return structuredClone(window.SEED_ENTREPRISES || []);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rows));
    } catch (err) {
      banner("Enregistrement impossible (navigation privée ou stockage plein). Exportez vos données en CSV.", true);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Utilitaires
  // ---------------------------------------------------------------------------
  const isoDate = (d) => {
    // Date locale au format AAAA-MM-JJ (toISOString utiliserait l'heure UTC)
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const today = () => isoDate(new Date());
  const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
  const frDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
  const newId = () => "e-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Minuscules sans accents, pour une recherche tolérante
  const norm = (s) => (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // Échappement HTML : indispensable avant d'insérer du texte saisi dans innerHTML (protection XSS)
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // N'autorise que les liens http(s), pour éviter les liens « javascript: »
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

  const prio = (r) => Number(r.priorite) || 0;
  // Les lignes sans métier (anciennes données) comptent comme « Développement »
  const metierOf = (r) => r.metier || "Développement";

  // Une relance est due si la candidature est partie et que la date de relance est passée
  const isDue = (r) =>
    r.dateRelance && r.dateRelance <= today() &&
    (r.statut === "Candidature envoyée" || r.statut === "Relance faite");

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 2600);
  }

  function banner(msg, warn) {
    const b = $("banner");
    if (!msg) { b.hidden = true; return; }
    b.textContent = msg;
    b.className = "banner" + (warn ? " warn" : "");
    b.hidden = false;
  }

  function fillSelect(sel, values, emptyLabel) {
    sel.innerHTML = (emptyLabel ? `<option value="">${esc(emptyLabel)}</option>` : "") +
      values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  // ---------------------------------------------------------------------------
  // 4. Opérations sur les données
  // ---------------------------------------------------------------------------
  function addRow(data) {
    state.rows.push({ id: newId(), priorite: 0, ...data });
    save();
    render(true);
  }

  // Modifie un ou plusieurs champs d'une ligne
  function setFields(id, patch, rerender = true) {
    const r = state.rows.find((x) => x.id === id);
    if (!r) return;
    // Passage en « Candidature envoyée » : date du jour + relance programmée
    if (patch.statut === "Candidature envoyée") {
      if (!r.dateCandidature && !patch.dateCandidature) patch.dateCandidature = today();
      if (!r.dateRelance && !patch.dateRelance) patch.dateRelance = plusDays(RELANCE_APRES_ENVOI);
    }
    Object.assign(r, patch);
    save();
    if (rerender) render(true);
  }

  function deleteRow(id) {
    const r = state.rows.find((x) => x.id === id);
    state.rows = state.rows.filter((x) => x.id !== id);
    save();
    render(true);
    toast(`${r ? r.nom : "Ligne"} supprimée`);
  }

  // ---------------------------------------------------------------------------
  // 5. Affichage
  // ---------------------------------------------------------------------------

  // Lignes visibles après filtres et tri
  function visibleRows() {
    const { q, dep, statut, type, metier } = state.filters;
    const nq = norm(q);
    const list = state.rows.filter((r) =>
      (!dep || r.dep === dep) &&
      (!statut || r.statut === statut) &&
      (!type || r.type === type) &&
      (!metier || metierOf(r) === metier) &&
      (!nq || norm([r.nom, r.ville, r.technos, r.notes, r.contact, r.type, metierOf(r)].join(" ")).includes(nq)));

    const { k, dir } = state.sort;
    return list.sort((a, b) => {
      if (k === "priorite") return (prio(a) - prio(b)) * dir || a.nom.localeCompare(b.nom, "fr");
      const va = (a[k] ?? "").toString(), vb = (b[k] ?? "").toString();
      if (!va && vb) return 1;      // les cases vides vont toujours à la fin
      if (va && !vb) return -1;
      return va.localeCompare(vb, "fr", { numeric: true, sensitivity: "base" }) * dir;
    });
  }

  const input = (r, k, cls = "") =>
    `<input class="cell ${cls}" data-id="${r.id}" data-k="${k}" value="${esc(r[k])}" aria-label="${k}">`;

  const options = (values, current) =>
    values.map((v) => `<option${v === current ? " selected" : ""}>${esc(v)}</option>`).join("");

  function stars(r) {
    return `<span class="stars" role="group" aria-label="Priorité">${[1, 2, 3].map((v) =>
      `<button type="button" class="star${prio(r) >= v ? " on" : ""}" data-star="${r.id}" data-v="${v}"
        aria-label="Priorité ${v} sur 3" aria-pressed="${prio(r) >= v}">★</button>`).join("")}</span>`;
  }

  function rowHtml(r) {
    const confirming = state.confirmId === r.id;
    const link = safeUrl(r.lien);
    return `<tr class="${isDue(r) ? "due" : ""}">
      <td>${input(r, "nom", "name")}${r.source ? `<div class="src">${esc(r.source)}</div>` : ""}</td>
      <td>${input(r, "ville")}</td>
      <td class="dep-cell"><select class="cell" data-id="${r.id}" data-k="dep" aria-label="Département">${options(DEPS.map((d) => d[0]), r.dep)}</select></td>
      <td><select class="cell metier" data-m="${esc(metierOf(r))}" data-id="${r.id}" data-k="metier" aria-label="Métier">${options(METIERS, metierOf(r))}</select></td>
      <td><select class="cell" data-id="${r.id}" data-k="type" aria-label="Type">${options(TYPES, r.type)}</select></td>
      <td>${input(r, "technos")}</td>
      <td>${stars(r)}</td>
      <td><select class="status" data-s="${esc(r.statut)}" data-id="${r.id}" data-k="statut" aria-label="Statut">${options(STATUTS, r.statut)}</select></td>
      <td><input type="date" class="cell mono" data-id="${r.id}" data-k="dateCandidature" value="${esc(r.dateCandidature)}" aria-label="Date de candidature"></td>
      <td><input type="date" class="cell mono" data-id="${r.id}" data-k="dateRelance" value="${esc(r.dateRelance)}" aria-label="Date de relance"></td>
      <td>${input(r, "contact")}</td>
      <td><textarea class="cell" rows="1" data-id="${r.id}" data-k="notes" aria-label="Notes">${esc(r.notes)}</textarea></td>
      <td><div class="rowact">
        ${link ? `<a class="linkbtn" href="${esc(link)}" target="_blank" rel="noopener">Site ↗</a>` : ""}
        <button type="button" data-lien="${r.id}" title="Modifier le lien">Lien</button>
        <button type="button" class="${confirming ? "confirm" : "danger"}" data-del="${r.id}">${confirming ? "Confirmer" : "Suppr."}</button>
      </div></td>
    </tr>`;
  }

  // force = true : redessine même si l'utilisateur est en train de taper
  function render(force = false) {
    const tbody = $("tbody");
    const typing = tbody.contains(document.activeElement) && document.activeElement.matches("input, textarea");
    if (!force && typing) { state.renderPending = true; renderSummary(); return; }
    state.renderPending = false;

    const list = visibleRows();
    tbody.innerHTML = list.map(rowHtml).join("");

    const empty = $("empty");
    if (state.rows.length === 0) {
      empty.innerHTML = "<strong>Aucune entreprise pour l'instant</strong>Ajoutez la première avec « Ajouter », ou importez un fichier CSV.";
      empty.hidden = false;
    } else if (list.length === 0) {
      empty.innerHTML = "<strong>Aucun résultat</strong>Aucune entreprise ne correspond à ces filtres.";
      empty.hidden = false;
    } else {
      empty.hidden = true;
    }

    $("thead").querySelectorAll("th").forEach((th) => {
      if (th.dataset.k === state.sort.k) th.setAttribute("aria-sort", state.sort.dir > 0 ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });
    renderSummary();
  }

  function renderSummary() {
    const rows = state.rows;
    const count = (fn) => rows.filter(fn).length;
    $("s-total").textContent = rows.length;
    $("s-todo").textContent = count((r) => r.statut === "À contacter");
    $("s-sent").textContent = count((r) => r.statut !== "À contacter");
    $("s-int").textContent = count((r) => r.statut === "Entretien");
    $("s-due").textContent = count(isDue);
    renderTodo();
  }

  function renderTodo() {
    const t = new Date(today());
    const due = state.rows.filter(isDue).sort((a, b) => a.dateRelance.localeCompare(b.dateRelance));
    $("todo-due-n").textContent = due.length;
    $("todo-due").innerHTML = due.length
      ? due.slice(0, 8).map((r) => {
          const late = Math.round((t - new Date(r.dateRelance)) / 86400000);
          return `<li>
            <span class="who"><b>${esc(r.nom)}</b><small>${esc(r.ville)} · envoyée le ${esc(frDate(r.dateCandidature) || "?")}</small></span>
            <span class="late">${late === 0 ? "aujourd'hui" : `+${late} j`}</span>
            <button type="button" data-done="${r.id}">Relance faite</button>
            <button type="button" data-see="${esc(r.nom)}">Voir</button>
          </li>`;
        }).join("")
      : `<li class="none">Aucune relance en attente. Quand vous passez une entreprise en « Candidature envoyée », sa relance apparaît ici ${RELANCE_APRES_ENVOI} jours plus tard.</li>`;

    const top = state.rows
      .filter((r) => r.statut === "À contacter" && prio(r) >= 2)
      .sort((a, b) => prio(b) - prio(a) || a.nom.localeCompare(b.nom, "fr"));
    $("todo-prio-n").textContent = top.length;
    $("todo-prio").innerHTML = top.length
      ? top.slice(0, 8).map((r) => `<li>
          <span class="who"><b>${esc(r.nom)}</b><small>${esc(r.ville)}${r.technos ? " · " + esc(r.technos) : ""}</small></span>
          <span class="late">${"★".repeat(prio(r))}</span>
          <button type="button" data-sent="${r.id}">Candidature envoyée</button>
        </li>`).join("")
      : `<li class="none">Donnez 2 ou 3 étoiles aux entreprises qui vous intéressent le plus : elles apparaîtront ici tant que vous ne les avez pas contactées.</li>`;
  }

  // ---------------------------------------------------------------------------
  // 6. Événements
  // ---------------------------------------------------------------------------
  // Thème clair / sombre : suit le système, sauf choix explicite mémorisé
  function setupTheme() {
    const KEY = "alternance-bfc:theme";
    const root = document.documentElement;
    try { const t = localStorage.getItem(KEY); if (t) root.dataset.theme = t; } catch (err) { /* stockage indisponible */ }
    $("btn-theme").addEventListener("click", () => {
      const dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem(KEY, root.dataset.theme); } catch (err) { /* stockage indisponible */ }
    });
  }

  function setupControls() {
    // Filtre par département
    $("deps").innerHTML =
      `<button type="button" class="dep" data-dep="" aria-pressed="true">Toute la région</button>` +
      DEPS.map(([n, l]) => `<button type="button" class="dep" data-dep="${n}" aria-pressed="false">${n} · ${esc(l)}</button>`).join("");
    $("deps").addEventListener("click", (e) => {
      const b = e.target.closest(".dep");
      if (!b) return;
      state.filters.dep = b.dataset.dep;
      $("deps").querySelectorAll(".dep").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render(true);
    });

    fillSelect($("f-status"), STATUTS, "Tous les statuts");
    fillSelect($("f-type"), TYPES, "Tous les types");
    fillSelect($("f-metier"), METIERS, "Tous les métiers");
    fillSelect($("a-metier"), METIERS);
    fillSelect($("a-statut"), STATUTS);
    fillSelect($("a-type"), TYPES);
    $("a-dep").innerHTML = DEPS.map(([n, l]) => `<option value="${n}">${n} · ${esc(l)}</option>`).join("");

    $("q").addEventListener("input", (e) => { state.filters.q = e.target.value; render(true); });
    $("f-status").addEventListener("change", (e) => { state.filters.statut = e.target.value; render(true); });
    $("f-type").addEventListener("change", (e) => { state.filters.type = e.target.value; render(true); });
    $("f-metier").addEventListener("change", (e) => { state.filters.metier = e.target.value; render(true); });

    // En-têtes cliquables pour trier
    $("thead").innerHTML = COLS.map((c) =>
      `<th style="min-width:${c.w}" data-k="${c.k}" class="${c.nosort ? "nosort" : ""}" ${c.nosort ? "" : 'tabindex="0"'}>${c.label}</th>`).join("");
    $("thead").addEventListener("click", (e) => {
      const th = e.target.closest("th");
      if (!th || th.classList.contains("nosort")) return;
      const k = th.dataset.k;
      state.sort = state.sort.k === k ? { k, dir: -state.sort.dir } : { k, dir: k === "priorite" ? -1 : 1 };
      render(true);
    });
    $("thead").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.click(); });

    // Formulaire d'ajout
    $("btn-add").addEventListener("click", () => { $("addform").hidden = false; $("a-nom").focus(); });
    $("a-cancel").addEventListener("click", () => { $("addform").reset(); $("addform").hidden = true; });
    $("addform").addEventListener("submit", (e) => {
      e.preventDefault();
      const statut = $("a-statut").value;
      const data = {
        nom: $("a-nom").value.trim(),
        ville: $("a-ville").value.trim(),
        dep: $("a-dep").value,
        type: $("a-type").value,
        metier: $("a-metier").value,
        technos: $("a-technos").value.trim(),
        contact: $("a-contact").value.trim(),
        lien: $("a-lien").value.trim(),
        statut,
        priorite: Number($("a-prio").value) || 0,
        notes: $("a-notes").value.trim(),
        dateCandidature: statut === "À contacter" ? "" : today(),
        dateRelance: statut === "Candidature envoyée" ? plusDays(RELANCE_APRES_ENVOI) : "",
        source: "Ajout manuel",
      };
      if (!data.nom) return;
      addRow(data);
      $("addform").reset();
      $("addform").hidden = true;
      toast(`${data.nom} ajoutée`);
    });

    // Édition directe dans le tableau
    const tbody = $("tbody");
    tbody.addEventListener("change", (e) => {
      const el = e.target;
      if (!el.dataset.id) return;
      const value = el.value.trim();
      const isStatus = el.classList.contains("status");
      if (isStatus) el.dataset.s = value;
      if (el.classList.contains("metier")) el.dataset.m = value;
      // Statut et dates changent le surlignage et le panneau : on redessine
      setFields(el.dataset.id, { [el.dataset.k]: value }, isStatus || el.type === "date");
    });
    tbody.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches("input.cell")) e.target.blur();
    });
    tbody.addEventListener("focusout", () => {
      // Le rendu mis en attente pendant la saisie est appliqué à la sortie du tableau
      setTimeout(() => { if (state.renderPending && !tbody.contains(document.activeElement)) render(); }, 0);
    });
    tbody.addEventListener("click", (e) => {
      const star = e.target.closest("[data-star]");
      if (star) {
        const r = state.rows.find((x) => x.id === star.dataset.star);
        const v = Number(star.dataset.v);
        setFields(r.id, { priorite: prio(r) === v ? 0 : v });   // recliquer enlève la priorité
        return;
      }
      const del = e.target.closest("[data-del]");
      if (del) {
        const id = del.dataset.del;
        if (state.confirmId === id) { state.confirmId = null; deleteRow(id); return; }
        state.confirmId = id;
        render(true);
        setTimeout(() => { if (state.confirmId === id) { state.confirmId = null; render(); } }, 4000);
        return;
      }
      const lienBtn = e.target.closest("[data-lien]");
      if (lienBtn) {
        const r = state.rows.find((x) => x.id === lienBtn.dataset.lien);
        const td = lienBtn.closest("td");
        td.innerHTML = `<input class="cell mono" type="url" data-id="${r.id}" data-k="lien" value="${esc(r.lien)}" placeholder="https://" aria-label="Lien">`;
        const inp = td.querySelector("input");
        inp.focus();
        inp.addEventListener("blur", () => render(true), { once: true });
      }
    });

    // Panneau « À faire »
    $("todo").addEventListener("click", (e) => {
      const done = e.target.closest("[data-done]");
      if (done) {
        setFields(done.dataset.done, { statut: "Relance faite", dateRelance: plusDays(RELANCE_SUIVANTE) });
        toast(`Relance notée, prochaine dans ${RELANCE_SUIVANTE} jours`);
        return;
      }
      const sent = e.target.closest("[data-sent]");
      if (sent) {
        setFields(sent.dataset.sent, { statut: "Candidature envoyée" });
        toast(`Candidature notée, relance dans ${RELANCE_APRES_ENVOI} jours`);
        return;
      }
      const see = e.target.closest("[data-see]");
      if (see) {
        $("q").value = see.dataset.see;
        state.filters.q = see.dataset.see;
        render(true);
        $("q").scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });

    // Export / import / réinitialisation
    $("btn-export").addEventListener("click", exportCsv);
    $("btn-import").addEventListener("click", () => $("file").click());
    $("file").addEventListener("change", importCsv);
    $("btn-reset").addEventListener("click", () => {
      const btn = $("btn-reset");
      if (!state.resetArmed) {
        state.resetArmed = true;
        btn.textContent = "Confirmer : tout effacer ?";
        setTimeout(() => { state.resetArmed = false; btn.textContent = "Réinitialiser"; }, 4000);
        return;
      }
      state.resetArmed = false;
      btn.textContent = "Réinitialiser";
      state.rows = structuredClone(window.SEED_ENTREPRISES || []);
      save();
      render(true);
      toast("Liste de départ restaurée");
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Export / import CSV
  // ---------------------------------------------------------------------------

  // Excel en français attend « ; » comme séparateur et un BOM UTF-8 pour les accents
  function toCsv(list) {
    const cell = (v) => {
      const s = (v ?? "").toString();
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = CSV_COLS.map(([label]) => label).join(";");
    const lines = list.map((r) => CSV_COLS.map(([, k]) => cell(r[k])).join(";"));
    return "﻿" + [header, ...lines].join("\r\n");
  }

  function exportCsv() {
    const blob = new Blob([toCsv(visibleRows())], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alternance-bfc-${today()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Fichier CSV téléchargé");
  }

  // Lecteur CSV qui gère les guillemets et les retours à la ligne dans les cellules
  function parseCsv(text, sep) {
    const out = [];
    let row = [], cur = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
        } else cur += c;
      } else if (c === '"') inQuotes = true;
      else if (c === sep) { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = "";
        if (row.some((x) => x !== "")) out.push(row);
        row = [];
      } else cur += c;
    }
    row.push(cur);
    if (row.some((x) => x !== "")) out.push(row);
    return out;
  }

  async function importCsv(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const text = (await file.text()).replace(/^﻿/, "");
    const firstLine = text.split(/\r?\n/)[0];
    const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
    const data = parseCsv(text, sep);
    if (data.length < 2) { toast("Fichier vide ou illisible."); return; }

    // Correspondance titre de colonne -> champ (sans accents ni majuscules)
    const map = {
      entreprise: "nom", nom: "nom", ville: "ville", departement: "dep", dep: "dep", "dep.": "dep",
      type: "type", metier: "metier", technos: "technos", priorite: "priorite", statut: "statut",
      "date candidature": "dateCandidature", "envoyee le": "dateCandidature",
      "date relance": "dateRelance", "relance le": "dateRelance",
      contact: "contact", lien: "lien", site: "lien", notes: "notes", source: "source",
    };
    const keys = data[0].map((h) => map[norm(h).trim()] || null);
    if (!keys.includes("nom")) { toast("Colonne « Entreprise » introuvable dans le fichier."); return; }

    const key = (r) => norm(r.nom) + "|" + norm(r.ville);
    const existing = new Set(state.rows.map(key));
    let added = 0;
    for (const line of data.slice(1)) {
      const r = {
        id: newId(), nom: "", ville: "", dep: "", type: "Autre", metier: "Développement", technos: "", priorite: 0,
        statut: "À contacter", dateCandidature: "", dateRelance: "", contact: "", lien: "", notes: "",
        source: "Import CSV",
      };
      keys.forEach((k, i) => { if (k && line[i] != null) r[k] = line[i].trim(); });
      if (!r.nom || existing.has(key(r))) continue;           // ignore les doublons
      if (!STATUTS.includes(r.statut)) r.statut = "À contacter";
      if (!TYPES.includes(r.type)) r.type = "Autre";
      if (!METIERS.includes(r.metier)) r.metier = "Développement";
      r.priorite = Math.max(0, Math.min(3, parseInt(r.priorite, 10) || 0));
      existing.add(key(r));
      state.rows.push(r);
      added++;
    }
    save();
    render(true);
    toast(added ? `${added} entreprise(s) importée(s)` : "Aucune nouvelle entreprise dans ce fichier.");
  }

  // ---------------------------------------------------------------------------
  // 8. Démarrage
  // ---------------------------------------------------------------------------
  setupTheme();
  state.rows = load();
  setupControls();
  render(true);
})();

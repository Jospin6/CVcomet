"use strict";

// Prototype de phase 0. Aucune requête réseau, clé, donnée réelle ou persistance de profil.
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const icon = name => '<svg class="icon" aria-hidden="true"><use href="#icon-' + name + '"></use></svg>';
function renderIcons() {
  $$("[data-icon]").forEach(element => { element.innerHTML = icon(element.dataset.icon); });
}

const templateData = [
  {id:"clarte",name:"Clarté",category:"Essentiel",caption:"L’essentiel, avec évidence.",description:"Une colonne, une hiérarchie nette et beaucoup de respiration. Une présentation sobre pour laisser votre expérience parler.",accent:"#285446",tag:"Sélection"},
  {id:"equilibre",name:"Équilibre",category:"Moderne",caption:"Une structure qui fait la différence.",description:"Un en-tête affirmé et des sections bien rythmées. Une composition polyvalente pour les parcours riches et variés.",accent:"#355d82",tag:""},
  {id:"studio",name:"Studio",category:"Créatif",caption:"Du caractère. Juste ce qu’il faut.",description:"Une typographie expressive et une mise en page éditoriale. Pour présenter votre sens du détail sans sacrifier la lisibilité.",accent:"#85634b",tag:""},
  {id:"signature",name:"Signature",category:"Direction",caption:"Une présence calme et assurée.",description:"Un en-tête classique, des lignes fines et une composition équilibrée. L’espace est au service de votre parcours.",accent:"#3b3b3b",tag:""},
  {id:"perspective",name:"Perspective",category:"Moderne",caption:"Votre parcours sous le bon angle.",description:"Un accent latéral discret guide le regard, tandis que les sections restent lisibles et bien délimitées.",accent:"#285446",tag:""},
  {id:"essentiel",name:"Essentiel",category:"Essentiel",caption:"Simple, précis, intemporel.",description:"Un format épuré qui donne toute la place au contenu. Une base claire, sans éléments superflus.",accent:"#3b3b3b",tag:""}
];
const demoProfile = {name:"Camille Moreau",email:"camille@example.com",title:"Product designer",location:"Lyon, France",summary:"",skills:""};
let profile = {...demoProfile};
let demoMode = "filled";
let currentType = "cv";
let currentCategory = "all";
let selectedTemplates = {cv:"clarte",letter:null};
let previewTemplate = templateData[0];
let previewType = "cv";
let currentAccent = previewTemplate.accent;
let toastTimer;

function documentPaper(template, type = "cv", accent = template.accent) {
  const name = escapeHTML(profile.name || "Camille Moreau");
  const title = escapeHTML(profile.title || "Product designer");
  const email = escapeHTML(profile.email || "camille@example.com");
  const city = escapeHTML(profile.location || "Lyon, France");
  const summary = escapeHTML(profile.summary || "Je conçois des expériences numériques claires et accessibles. Mon approche associe recherche utilisateur, réflexion produit et attention portée aux détails.");
  const skills = escapeHTML(profile.skills || "Recherche utilisateur · Prototypage · Design d’interface");
  const heading = '<h4>' + name + '</h4><div class="paper-role">' + title + '</div><div class="paper-contact">' + email + ' &nbsp;·&nbsp; ' + city + '</div>';
  const body = type === "letter"
    ? '<div class="paper-section"><h5>Candidature · Product designer</h5><div class="paper-date">Exemple de lettre — contenu fictif</div></div><div class="letter-body"><p>Madame, Monsieur,</p><p>Votre approche du design produit fait écho à mon envie de concevoir des expériences utiles, lisibles et accessibles.</p><p>Mon parcours m’a permis de relier les besoins des utilisateurs aux objectifs d’un produit. J’apprécie particulièrement la collaboration avec les équipes techniques, de la première idée au détail de l’interface.</p><p>Je serais ravie d’échanger avec vous pour découvrir vos projets et vous présenter mon travail.</p><p>Je vous remercie pour votre attention.<br><br>' + name + '</p></div>'
    : '<div class="paper-section"><h5>Profil</h5><p>' + summary + '</p></div><div class="paper-section"><h5>Expérience</h5><h6>Product designer · Studio Exemple</h6><div class="paper-date">2023 — Aujourd’hui · Parcours fictif</div><p>Conception de parcours et de prototypes pour des produits numériques.<br>Collaboration avec les équipes produit et développement.</p><h6>Designer UX/UI · Atelier Démonstration</h6><div class="paper-date">2021 — 2023 · Parcours fictif</div><p>Recherche utilisateur, interfaces et documentation des composants.</p></div><div class="paper-section"><h5>Formation</h5><h6>Diplôme de design numérique</h6><p>École de démonstration · 2021</p></div><div class="paper-columns"><div><h5>Compétences</h5><p>' + skills + '</p></div><div><h5>Langues</h5><p>Français<br>Anglais</p></div></div>';
  return '<div class="paper paper--' + template.id + (type === "letter" ? " letter" : "") + '" style="--paper-accent:' + accent + '">' + heading + body + '</div>';
}

function renderGallery() {
  const search = $("#template-search").value.trim().toLocaleLowerCase("fr");
  let matches = templateData.filter(template => (currentCategory === "all" || template.category === currentCategory) && (template.name + " " + template.category).toLocaleLowerCase("fr").includes(search));
  if ($("#template-sort").value === "name") matches.sort((a,b) => a.name.localeCompare(b.name,"fr"));
  $("#template-grid").innerHTML = matches.map(template => {
    const selected = selectedTemplates[currentType] === template.id;
    return '<button class="template-card' + (selected ? " selected" : "") + '" data-preview="' + template.id + '" aria-label="Prévisualiser ' + template.name + (selected ? ", modèle sélectionné" : "") + '"><div class="template-art">' + (selected ? '<span class="template-badge">Sélectionné</span>' : template.tag ? '<span class="template-badge">' + template.tag + '</span>' : "") + documentPaper(template,currentType) + '<span class="preview-hover">' + icon("Expand") + 'Aperçu du modèle</span></div><div class="template-info"><div><h3>' + template.name + '</h3><p>' + template.category + ' · ' + template.caption + '</p></div>' + icon(selected ? "CircleCheck" : "ArrowUpRight") + '</div></button>';
  }).join("");
  $("#gallery-count").textContent = matches.length + (matches.length > 1 ? " modèles" : " modèle") + (currentType === "letter" ? " de lettre" : " de CV");
  $("#empty-templates").hidden = matches.length !== 0;
  $("#template-grid").hidden = matches.length === 0;
}

function renderRecent() {
  const documents = [
    {title:"Mon parcours · Design produit",detail:"CV · Modèle Clarté",template:"clarte",type:"cv",icon:"FileText",status:"Exemple de CV"},
    {title:"Une nouvelle perspective",detail:"Lettre · Modèle Signature",template:"signature",type:"letter",icon:"Mail",status:"Exemple de lettre"},
    {title:"Version orientée UX",detail:"CV · Modèle Équilibre",template:"equilibre",type:"cv",icon:"FileText",status:"Exemple de CV"}
  ];
  $("#recent-documents").hidden = demoMode === "empty";
  $("#empty-documents").hidden = demoMode !== "empty";
  $("#doc-count").textContent = demoMode === "empty" ? "0" : String(documents.length);
  $("#recent-documents").innerHTML = documents.map(doc => '<button class="document-card" data-preview="' + doc.template + '" data-document-type="' + doc.type + '"><div class="document-card-top">' + icon(doc.icon) + '<span class="status-pill">' + doc.status + '</span></div><h3>' + doc.title + '</h3><p>' + doc.detail + '</p><div class="document-meta"><span>Document de démonstration</span><span>Ouvrir ' + icon("ArrowUpRight") + '</span></div></button>').join("");
}

function updateProfile() {
  const fields = Object.values(profile);
  const complete = fields.filter(value => value.trim()).length;
  const percentage = Math.round(complete / fields.length * 100);
  $("#profile-percentage").innerHTML = percentage + "<span>%</span>";
  $("#profile-ring").style.strokeDashoffset = String(320.45 * (1 - percentage / 100));
  const ring = $(".progress-ring");
  ring.setAttribute("role","progressbar");
  ring.setAttribute("aria-label","Complétude du profil de démonstration");
  ring.setAttribute("aria-valuenow",String(percentage));
  ring.setAttribute("aria-valuemin","0");
  ring.setAttribute("aria-valuemax","100");
  $("#profile-hint").textContent = complete + " champs renseignés sur " + fields.length + ". " + (complete === fields.length ? "Votre base est prête à être enrichie." : "Chaque détail aide à mieux vous présenter.");
  $("#greeting-name").textContent = profile.name.trim().split(/\s+/)[0] || "à vous";
  $("#sidebar-name").textContent = profile.name || "Votre espace";
  const initials = profile.name.trim().split(/\s+/).filter(Boolean).map(word => word[0]).slice(0,2).join("").toUpperCase() || "VO";
  $("#sidebar-initials").textContent = initials;
  $(".avatar-small").textContent = initials;
  $("#hero-paper").innerHTML = documentPaper(templateData[0]);
}

function populateForm() {
  Object.entries(profile).forEach(([name,value]) => { $("#profile-form").elements.namedItem(name).value = value; });
}

const screenTitles = {overview:"Vue d’ensemble",templates:"Modèles",profile:"Profil carrière"};
function closeNav() {
  document.body.classList.remove("nav-open");
  $("#menu-toggle").setAttribute("aria-expanded","false");
  $("#app").inert = false;
  $("#sidebar").removeAttribute("aria-modal");
}
function go(screen) {
  closeNav();
  if (location.hash === "#" + screen) renderScreen(true);
  else location.hash = screen;
}
function renderScreen(focus = false) {
  const screen = Object.hasOwn(screenTitles,location.hash.slice(1)) ? location.hash.slice(1) : "overview";
  $$("[data-screen]").forEach(section => { section.hidden = section.dataset.screen !== screen; });
  $$("[data-nav]").forEach(link => {
    if(link.dataset.nav === screen) link.setAttribute("aria-current","page");
    else link.removeAttribute("aria-current");
  });
  $("#breadcrumb-current").textContent = screenTitles[screen];
  document.title = screenTitles[screen] + " · CVcomet — Maquette";
  closeNav();
  if(focus) {
    window.scrollTo({top:0,behavior:"instant"});
    $("#" + screen + "-heading").focus({preventScroll:true});
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  $("#toast-message").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => { $("#toast").hidden = true; },4800);
}
function openPreview(id,type=currentType) {
  previewTemplate = templateData.find(template => template.id === id) || templateData[0];
  previewType = type;
  currentAccent = previewTemplate.accent;
  $("#preview-title").textContent = previewTemplate.name;
  $("#preview-description").textContent = previewTemplate.description;
  $("#preview-paper").innerHTML = documentPaper(previewTemplate,type,currentAccent);
  $$("[data-accent]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.accent === currentAccent)));
  $("#preview-dialog").showModal();
}
function resetFilters() {
  currentCategory = "all";
  $("#template-search").value = "";
  $("#template-sort").value = "default";
  $$("[data-category]").forEach(button => {
    const active=button.dataset.category === "all";
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  renderGallery();
}

document.addEventListener("click",event => {
  const button = event.target.closest("[data-go]");
  if(button) go(button.dataset.go);
  const preview = event.target.closest("[data-preview]");
  if(preview) openPreview(preview.dataset.preview,preview.dataset.documentType || currentType);
  const close = event.target.closest("[data-close-dialog]");
  if(close) close.closest("dialog").close();
  if(event.target.closest("[data-close-nav]")) { closeNav(); $("#menu-toggle").focus(); }
});
$$("[data-nav]").forEach(link => link.addEventListener("click",() => closeNav()));
window.addEventListener("hashchange",() => renderScreen(true));
window.addEventListener("resize",() => { if(window.innerWidth > 780) closeNav(); });

$("#menu-toggle").addEventListener("click",() => {
  document.body.classList.add("nav-open");
  $("#menu-toggle").setAttribute("aria-expanded","true");
  $("#app").inert = true;
  $(".mobile-close").focus();
});
document.addEventListener("keydown",event => {
  if(!document.body.classList.contains("nav-open")) return;
  if(event.key === "Escape") { closeNav(); $("#menu-toggle").focus(); }
  if(event.key === "Tab") {
    const controls = $$('a[href],button:not(:disabled)', $("#sidebar")).filter(element => element.getClientRects().length);
    const first = controls[0], last = controls[controls.length-1];
    if(event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if(!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
$$("[data-documents]").forEach(link => link.addEventListener("click",event => {
  event.preventDefault();
  go("overview");
  setTimeout(() => $("#documents").scrollIntoView({block:"start"}),50);
}));
$$("[data-profile-anchor]").forEach(link => link.addEventListener("click",event => {
  event.preventDefault();
  const section = $("#" + link.dataset.profileAnchor);
  section.scrollIntoView({block:"start"});
  $("input,textarea",section).focus({preventScroll:true});
}));
$$("[data-category]").forEach(button => button.addEventListener("click",() => {
  currentCategory = button.dataset.category;
  $$("[data-category]").forEach(item => {
    const active=item === button; item.classList.toggle("active",active); item.setAttribute("aria-pressed",String(active));
  });
  renderGallery();
}));
$$("[data-type]").forEach(button => button.addEventListener("click",() => {
  currentType = button.dataset.type;
  $$("[data-type]").forEach(item => {
    const active=item === button; item.classList.toggle("active",active); item.setAttribute("aria-pressed",String(active));
  });
  renderGallery();
}));
$("#template-search").addEventListener("input",renderGallery);
$("#template-sort").addEventListener("change",renderGallery);
$("#reset-filters").addEventListener("click",resetFilters);
$("#letter-action").addEventListener("click",() => {
  $('[data-type="letter"]').click();
  resetFilters();
  go("templates");
});
$$("[data-accent]").forEach(button => button.addEventListener("click",() => {
  currentAccent = button.dataset.accent;
  $("#preview-paper .paper").style.setProperty("--paper-accent",currentAccent);
  $$("[data-accent]").forEach(item => item.setAttribute("aria-pressed",String(item === button)));
}));
$("#select-template").addEventListener("click",() => {
  selectedTemplates[previewType] = previewTemplate.id;
  $("#preview-dialog").close();
  renderGallery();
  showToast("Modèle " + previewTemplate.name + " sélectionné dans la maquette.");
});

$("#demo-state").addEventListener("change",event => {
  demoMode = event.target.value;
  profile = demoMode === "filled" ? {...demoProfile} : Object.fromEntries(Object.keys(demoProfile).map(key => [key,""]));
  populateForm();
  updateProfile();
  renderRecent();
  renderGallery();
  $("#save-status").textContent = "Les modifications restent dans cette visite de démonstration.";
});
$("#profile-form").addEventListener("submit",event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  profile = Object.fromEntries(Object.keys(demoProfile).map(key => [key,String(form.get(key)||"").trim()]));
  updateProfile();
  renderGallery();
  $("#save-status").textContent = "Profil mis à jour pour cette visite. Aucune donnée envoyée.";
  showToast("Profil de démonstration mis à jour.");
});
$("#profile-form").addEventListener("input",() => {
  $("#save-status").textContent = "Modifications non enregistrées dans la maquette.";
});

let theme = "light";
try { theme = localStorage.getItem("cvcomet-concept-theme") || "light"; } catch {}
const themeParameter = new URLSearchParams(location.search).get("theme");
if(themeParameter === "dark" || themeParameter === "light") theme = themeParameter;
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $("#theme-toggle").innerHTML = icon(theme === "dark" ? "Sun" : "Moon");
  $("#theme-toggle").setAttribute("aria-label",theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre");
}
$("#theme-toggle").addEventListener("click",() => {
  theme = theme === "dark" ? "light" : "dark";
  applyTheme();
  try { localStorage.setItem("cvcomet-concept-theme",theme); } catch {}
});

const commandActions = [
  {label:"Vue d’ensemble",icon:"LayoutDashboard",screen:"overview"},
  {label:"Créer un CV · Choisir un modèle",icon:"FileText",screen:"templates",type:"cv"},
  {label:"Créer une lettre de motivation",icon:"Mail",screen:"templates",type:"letter"},
  {label:"Compléter mon profil carrière",icon:"ContactRound",screen:"profile"}
];
function renderCommands() {
  const query = $("#command-search").value.toLocaleLowerCase("fr");
  const matches = commandActions.filter(action => action.label.toLocaleLowerCase("fr").includes(query));
  $("#command-results").innerHTML = matches.length ? matches.map(action => '<button class="command-result" data-command="' + commandActions.indexOf(action) + '">' + icon(action.icon) + escapeHTML(action.label) + icon("ArrowUpRight") + '</button>').join("") : '<p class="command-result">Aucune action ne correspond.</p>';
}
function openCommands() {
  if($$("dialog[open]").length) return;
  $("#command-search").value = "";
  renderCommands();
  $("#command-dialog").showModal();
  $("#command-search").focus();
}
$("#search-trigger").addEventListener("click",openCommands);
$("#command-search").addEventListener("input",renderCommands);
$("#command-results").addEventListener("click",event => {
  const target = event.target.closest("[data-command]");
  if(!target) return;
  const action = commandActions[Number(target.dataset.command)];
  $("#command-dialog").close();
  if(action.type) $('[data-type="' + action.type + '"]').click();
  go(action.screen);
});
$("#command-search").addEventListener("keydown",event => {
  if(event.key === "ArrowDown") { event.preventDefault(); $(".command-result")?.focus(); }
  if(event.key === "Enter") { event.preventDefault(); $(".command-result")?.click(); }
});
$("#command-results").addEventListener("keydown",event => {
  if(event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const buttons = $$(".command-result",event.currentTarget);
  if(!buttons.length) return;
  const direction=event.key === "ArrowDown" ? 1 : -1;
  const next=(buttons.indexOf(document.activeElement)+direction+buttons.length)%buttons.length;
  event.preventDefault(); buttons[next].focus();
});
document.addEventListener("keydown",event => {
  if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault(); openCommands();
  }
});
$("#design-notes").addEventListener("click",() => $("#notes-dialog").showModal());
$$("dialog").forEach(dialog => dialog.addEventListener("click",event => {
  if(event.target !== dialog) return;
  const bounds=dialog.getBoundingClientRect();
  if(event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
}));

renderIcons();
applyTheme();
populateForm();
updateProfile();
renderGallery();
renderRecent();
renderScreen();

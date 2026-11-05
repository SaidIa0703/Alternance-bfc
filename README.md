<h1 align="center">📋 Alternance BFC</h1>

<p align="center">
  Application web pour recenser les entreprises de <b>Bourgogne-Franche-Comté</b> et suivre ses candidatures d'alternance en <b>développement</b>, <b>administration systèmes et réseaux</b> et <b>cybersécurité</b>, comme dans un tableur.
</p>

<p align="center">
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white"/>
  <img alt="CSS3" src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white"/>
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black"/>
  <img alt="Aucune dépendance" src="https://img.shields.io/badge/D%C3%A9pendances-aucune-2ea44f?style=for-the-badge"/>
</p>

---

## ✨ Fonctionnalités

- 🏢 **85 entreprises de départ** réparties sur les 8 départements (21, 25, 39, 58, 70, 71, 89, 90) : ESN, éditeurs, industriels, banques, collectivités et acteurs de la cybersécurité
- 🎯 **3 métiers** : Développement, Admin sys / réseau, Cybersécurité, avec un filtre dédié
- ✏️ **Édition directe** de chaque case, comme dans Excel : ville, technos, contact, notes, dates…
- 🚦 **Suivi des candidatures** : À contacter → Candidature envoyée → Relance faite → Entretien → Accepté / Refus
- ⏰ **Relances automatiques** : passer une entreprise en « Candidature envoyée » note la date du jour et programme une relance 10 jours plus tard
- ⭐ **Priorités** de 1 à 3 étoiles
- 📌 **Panneau « À faire »** : relances en retard et entreprises prioritaires pas encore contactées
- 🔍 **Recherche, filtres** (département, métier, statut, type) et **tri** par colonne
- 📤 **Export CSV** compatible Excel (séparateur `;` et accents conservés) et 📥 **import CSV** avec détection des doublons
- 💾 **Sauvegarde automatique** dans le navigateur (`localStorage`)
- 🌗 **Thème clair / sombre** automatique et affichage adapté au mobile

## 🚀 Lancer le projet

Aucune installation : ouvrez simplement `index.html` dans votre navigateur.

Ou avec un petit serveur local :

```bash
git clone https://github.com/SaidIa0703/alternance-bfc.git
cd alternance-bfc
python3 -m http.server 8000
# puis ouvrez http://localhost:8000
```

## 🌐 Mise en ligne

Le site est 100 % statique : il se déploie gratuitement sur **GitHub Pages** (Settings → Pages → branche `main`, dossier `/root`) ou sur **Cloudflare** (Workers & Pages → importer le dépôt, sans commande de build).

## 🗂️ Structure

```
alternance-bfc/
├── index.html        # Structure de la page
├── css/
│   └── style.css     # Styles, thèmes clair et sombre
└── js/
    ├── data.js       # Liste de départ des entreprises
    └── app.js        # Logique : stockage, affichage, filtres, CSV
```

## 🧠 Choix techniques

- **Vanilla JavaScript**, sans framework : le projet reste léger et chaque mécanisme est visible dans le code.
- **État centralisé** dans un objet `state`, et une fonction `render()` qui redessine le tableau à partir de cet état.
- **Délégation d'événements** : un seul écouteur sur le tableau gère toutes les cellules, même celles ajoutées plus tard.
- **Sécurité** : tout texte saisi est échappé avant d'être inséré dans le HTML (protection contre le XSS), et seuls les liens `http(s)` sont cliquables.
- **Rendu différé pendant la saisie**, pour ne pas faire perdre le curseur à l'utilisateur.
- **Accessibilité** : libellés ARIA, navigation au clavier et focus visible.

## ⚠️ Limites

Les données sont stockées dans **un seul navigateur, sur un seul appareil**. Vider les données du navigateur les efface : exportez régulièrement en CSV pour garder une sauvegarde.

## 🗺️ Évolutions possibles

- [ ] Synchronisation entre appareils (backend Node.js + base de données, ou Firebase)
- [ ] Rappels par e-mail ou notification pour les relances
- [ ] Tableau de bord avec graphiques (taux de réponse, candidatures par semaine)
- [ ] Tests unitaires des fonctions de tri, de filtre et de lecture CSV
- [ ] Récupération automatique des offres via l'API de France Travail

## 👤 Auteur

**Abdelghani Saidi**  étudiant en 3ᵉ année de bachelor à Colint School, en recherche d'alternance.
[GitHub](https://github.com/SaidIa0703) · [LinkedIn](https://www.linkedin.com/in/abdelghani-saidi-0469982a0) · [Portfolio](https://abdel-portfolio-s.saidiabdelghani0703.workers.dev/)

<sub>Les informations sur les entreprises proviennent d'offres publiques (France Travail, Indeed, salons de l'alternance) et de l'annuaire du CSIRT Bourgogne-Franche-Comté, consultés en 2025-2026. Vérifiez-les avant de candidater.</sub>

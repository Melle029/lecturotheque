# Lecturotheque - publication web

## Option rapide: Netlify Drop

1. Va sur https://app.netlify.com/drop
2. Glisse le dossier `outputs` dans la page.
3. Netlify donne une adresse du type `https://nom-du-site.netlify.app`.
4. Ouvre cette adresse sur ton ordinateur du travail et sur ton cellulaire.

## Option avec ton compte GitHub

1. Cree un depot GitHub.
2. Envoie tous les fichiers du dossier `outputs` a la racine du depot.
3. Va dans `Settings > Pages`.
4. Choisis `Deploy from a branch`, branche `main`, dossier `/root`.
5. GitHub donnera une adresse du type `https://ton-nom.github.io/lecturotheque/`.

Le fichier `README_GITHUB.md` contient les etapes detaillees.

## Installer sur cellulaire

Une fois le site ouvert en HTTPS:

- iPhone: bouton Partager, puis `Ajouter a l'ecran d'accueil`.
- Android/Chrome: menu, puis `Installer l'application` ou `Ajouter a l'ecran d'accueil`.

## Synchronisation cloud avec Supabase

1. Cree un projet sur https://supabase.com
2. Dans `SQL Editor`, colle et execute le contenu de `supabase_schema.sql`.
3. Dans `Authentication > URL Configuration`, ajoute l'adresse Netlify du site dans les URL autorisees.
4. Dans `Project Settings > API`, copie:
   - `Project URL`
   - `anon public key`
5. Ouvre Lecturotheque, section `Compte > Reglages cloud`, puis colle ces deux valeurs.
6. Entre ton courriel et clique `Connexion`. Supabase envoie un lien magique.

Apres connexion, le bouton `Sync` fusionne la bibliotheque locale et cloud. Les nouveaux documents, resumes et fiches sont ensuite sauvegardes dans le cloud.

## Encore a faire pour une version commerciale

- stockage cloud des fichiers PDF originaux;
- traduction serveur avec une API protegee;
- nom de domaine personnalise.

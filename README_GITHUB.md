# Publier Lecturotheque avec GitHub Pages

## Methode simple

1. Va sur https://github.com/new
2. Cree un depot, par exemple `lecturotheque`.
3. Dans le depot, clique `Add file`, puis `Upload files`.
4. Glisse tous les fichiers du dossier `outputs` dans la page GitHub.
5. Clique `Commit changes`.
6. Va dans `Settings > Pages`.
7. Dans `Build and deployment`, choisis:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
8. Clique `Save`.

Apres quelques minutes, GitHub donnera une adresse du genre:

`https://ton-nom.github.io/lecturotheque/`

## Pour le cellulaire

Ouvre l'adresse GitHub Pages sur ton telephone:

- iPhone: Partager, puis `Ajouter a l'ecran d'accueil`.
- Android: menu Chrome, puis `Installer l'application` ou `Ajouter a l'ecran d'accueil`.

## Synchronisation cloud

GitHub Pages met le site en ligne, mais la synchronisation des documents passe par Supabase.

Apres publication:

1. Cree ton projet Supabase.
2. Execute `supabase_schema.sql`.
3. Dans Supabase, ajoute l'adresse GitHub Pages dans les URL autorisees.
4. Dans l'app, colle l'URL Supabase et la cle `anon public`.

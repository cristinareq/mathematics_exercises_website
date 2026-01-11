# Math Trainer - Application d'Entraînement Mathématique

Une application web moderne pour l'entraînement aux mathématiques avec gestion des classes, devoirs et statistiques.

## Fonctionnalités

- **Entraînement libre** : Sessions personnalisables avec différents types d'opérations
- **Révision d'erreurs** : Système intelligent de correction des erreurs
- **Gestion des devoirs** : Création et attribution de devoirs par les enseignants
- **Statistiques complètes** : Suivi des progrès et performances
- **Support des fractions** : Calculs avec entiers, fractions et nombres négatifs
- **Interface responsive** : Fonctionne sur tous les appareils

## Technologies

- **Frontend** : Next.js 14, React, TypeScript, Tailwind CSS
- **Backend** : Supabase (PostgreSQL + Auth + RLS)
- **Déploiement** : Vercel
- **UI Components** : Radix UI, Shadcn/ui

## Installation

1. **Cloner le repository**
   \`\`\`bash
   git clone https://github.com/cristinareq/mathematics_exercises_website.git
   cd mathematics_exercises_website
   \`\`\`

2. **Installer les dépendances**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configuration de l'environnement**
   \`\`\`bash
   cp .env.local.example .env.local
   \`\`\`
   Puis remplir les variables dans `.env.local`

4. **Configuration de la base de données**
   - Créer un projet Supabase
   - Exécuter les scripts SQL dans `/scripts/`
   - Configurer les variables d'environnement

5. **Lancer en développement**
   \`\`\`bash
   npm run dev
   \`\`\`

## Configuration de la Base de Données

1. **Créer un projet Supabase** sur [supabase.com](https://supabase.com)

2. **Exécuter les scripts SQL** dans l'éditeur SQL de Supabase :
   - `scripts/deploy_setup.sql` - Configuration principale
   - `scripts/create_demo_data.sql` - Données de démonstration

3. **Configurer les variables d'environnement** :
   \`\`\`env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   \`\`\`

## Comptes de Démonstration

Après avoir exécuté le script de démonstration :

**Enseignant :**
- Utilisateur : `teacher1`
- Mot de passe : `demo123`

**Élèves :**
- `alice` / `demo123`
- `bob` / `demo123`
- `charlie` / `demo123`
- `diana` / `demo123`
- `eric` / `demo123`
- `franck` / `demo123`

## Déploiement

### Déploiement automatique avec Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cristinareq/mathematics_exercises_website&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY)

### Déploiement manuel

1. **Connecter à Vercel**
   - Aller sur [vercel.com](https://vercel.com)
   - Importer le repository GitHub
   - Configurer les variables d'environnement

2. **Variables d'environnement Vercel**
   \`\`\`
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   \`\`\`

## Utilisation

### Pour les Élèves
1. Se connecter avec ses identifiants
2. Choisir entre entraînement libre, révision d'erreurs ou devoirs
3. Configurer les paramètres d'entraînement
4. Répondre aux questions dans le temps imparti
5. Consulter ses statistiques et progrès

### Pour les Enseignants
1. Se connecter avec un compte enseignant
2. Créer des devoirs avec paramètres personnalisés
3. Attribuer les devoirs à des classes ou élèves spécifiques
4. Consulter les statistiques de performance
5. Suivre les progrès des élèves

## Architecture

\`\`\`
├── app/                 # Pages Next.js (App Router)
├── components/          # Composants React réutilisables
├── lib/                 # Utilitaires et types TypeScript
├── scripts/             # Scripts SQL pour la base de données
└── public/              # Assets statiques
\`\`\`

## Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Contacter l'équipe de développement

## Changelog

### v1.0.0
- Version initiale avec toutes les fonctionnalités de base
- Support complet des fractions et opérations mathématiques
- Interface enseignant et élève
- Système de devoirs et statistiques

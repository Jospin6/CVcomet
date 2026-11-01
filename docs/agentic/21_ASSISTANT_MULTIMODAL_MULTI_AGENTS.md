# CVComet — Extension Career Assistant multimodal et multi-agents

## Fonctionnement concret

L'extension part de l'application après les 20 étapes LangGraph. Elle conserve les missions persistantes, la progression SSE, les contrôles d'accès, les quotas, la mémoire opt-in, les approbations et le rollout Graph/Legacy.

### 1. Entrées et sorties utilisables

- **Texte** : conversations persistantes et historique dans `/dashboard/assistant`.
- **Images** : JPG, PNG, WEBP reçus en multipart, contrôle de signature, traitement éphémère par un modèle vision du fournisseur IA *actif*. Si le modèle actif est uniquement textuel, une erreur explicite est retournée **avant** la réservation du quota du planner ; aucune description d'image n'est inventée.
- **Documents** : PDF (texte natif, 50 pages max via le parseur existant), DOCX et TXT. Le texte extrait est borné à 8 000 caractères par document et 15 000 caractères par requête, marqué comme contenu non fiable. Les PDF scannés sans texte ne sont pas pris en charge sans OCR.
- **Voix d'entrée** : enregistrement du microphone avec permission du navigateur (maximum 45 secondes), transfert serveur et transcription réelle via le modèle OpenAI `whisper-1`. Nécessite une clé OpenAI configurée dans les paramètres IA ou sur le serveur, indépendamment du fournisseur de conversation actif. Aucun enregistrement audio n'est sauvegardé par cette route. Le texte de la transcription est seulement inséré dans le compositeur ; l'utilisateur décide de son envoi. Après envoi, la transcription devient un message de mission conservé dans son historique.
- **Voix de sortie** : bouton « Écouter » utilisant la synthèse vocale du navigateur ; ne constitue pas un service TTS cloud ni une conversation LiveKit en duplex.
- **Fichiers** : jusqu'à 3 fichiers, 5 Mo chacun et 12 Mo au total, limite serveur en nombre d'octets y compris sans Content-Length ; interdiction de type forgé, fichier nul, format non pris en charge ou document sans texte. Aucun transfert vers R2/Supabase public.

### 2. Architecture et stockage

- `src/lib/agentic/agents/supervisor/tools/multimodal.tool.ts` : validation, extraction, manifestes, empreintes.
- `src/lib/agentic/agents/supervisor/tools/vision.tool.ts` : garde-fou de compatibilité image/modèle.
- `POST /api/career/v1/missions/:id/runs` : JSON historique toujours compatible ; multipart pour les fichiers. La session et la propriété de la mission sont vérifiées **avant** l'extraction. Aucun outil, userId ou permission n'est contrôlé par le client.
- `POST /api/career/v1/agent/transcribe` : transcription OpenAI uniquement après authentification, validation du format/volume et réservation de quota, sans journaliser audio ou texte. Réponse `data.text` dans l'enveloppe API habituelle.
- `CareerMissionRun.attachmentsMeta` : noms nettoyés, formats, tailles, pas de contenu brut. `inputDigest` SHA-256 tenant compte du message, de l’application sélectionnée, du spécialiste demandé et des noms/empreintes des pièces jointes pour empêcher la réutilisation d’une requestKey avec un contexte différent. `specialist` : branche résolue par le serveur pour afficher un lien vers son espace.
- Les octets d'image, les extraits de document et les données des outils restent uniquement en mémoire pendant la requête ; pas de checkpoint LangGraph. À la réouverture d'une mission, les **métadonnées** restent visibles, mais pas les fichiers eux-mêmes. Le même document doit être renvoyé pour relancer une tentative échouée.
- Les choix du modèle et les preuves transmises à l'IA ne sont jamais traités comme des instructions ni comme des autorisations. Les profils, CV et candidatures restent chargés via des chemins propriétaires.

### 3. Orchestration des agents

Le superviseur sait sélectionner les domaines `general`, `profile`, `resume`, `cover_letter`, `ats`, `job_match`, `job_discovery`, `career_map`, `interview_text`, `interview_voice`, `application`, avec des listes d'outils de lecture dédiées et **aucun outil d'écriture**. La préférence « Auto / domaine » est une aide de routage, **pas** une élévation de privilèges.

- **Exécution réelle ajoutée** : pour `career_map`, un sous-graphe `runCareerMapAgent` est exécuté avec le profil actuel du propriétaire et produit un aperçu **non enregistré**, sans appel modèle supplémentaire. Son résultat est borné à quatre métiers du catalogue, et ses scores sont des couvertures de compétences, jamais des probabilités d'embauche.
- **Autres domaines** : lectures spécialisées dans le superviseur et liens directs vers leurs workflows existants. La création/modification des CV, lettres et dossiers, les évaluations ATS/Job Match coûteuses, la recherche d'offres réelles et les entretiens avec LiveKit restent accessibles dans leurs pages dédiées, où les paramètres typés, quotas, consentements et validations sont appliqués. **Ce patch ne prétend pas lancer tous ces graphes complets directement depuis le chat.**
- La sélection des outils reste plafonnée à 3 lectures, pas de boucles arbitraires, pas d'envoi de mail, candidature, publication ni paiement sans approbation.

### 4. Déploiement et contrôle

Tester sur **Neon staging après sauvegarde**. Copier les fichiers de l'archive cumulative dans le projet de référence, puis :

```bash
npm install
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run test:assistant:multimodal
npm run test:assistant:multimodal:integration
npm run eval:agentic:local
npm run typecheck
npm run build
```

La migration `20261101020000_career_assistant_multimodal` est additive et ne modifie pas les tables existantes par suppression. Déployer schéma + Prisma Client mis à jour **avant** les requêtes de l'interface. Une anomalie en staging doit bloquer le déploiement. Aucun `.env` ni secret n'est fourni dans l'archive.

### 5. Limites / recette requise

- Les tests locaux de syntaxe et les mocks ne prouvent pas la compatibilité exacte des fournisseurs OpenAI/Gemini/Anthropic ni la qualité de vision sur des images réelles.
- Il faut vérifier le support réel du modèle actif : capacités images, quota, durée, tailles, coûts et confidentialité fournisseur. `GROQ` et `HUGGINGFACE` ne sont pas annoncés comme compatibles image par ce garde-fou.
- Dictée et lecture vocale **non duplex** ; pas de LiveKit Realtime dans le chat général, ni de vidéo, ni d'OCR des PDF scannés.
- Pas de sauvegarde persistante des fichiers, ni de récupération de leur contenu à partir des seules métadonnées ; cela respecte le choix de ne pas créer un stockage privé supplémentaire dans cette extension.
- Tests manuels obligatoires : Android/Chrome, iOS/Safari si MediaRecorder disponible, refus du micro, fichier malformé, quota, CSRF, mission d'autrui, changement de pièces jointes avec requestKey identique, coûts des appels, reconnexion SSE, rédaction/approuvements, 11 orientations et qualité FR/EN.
- **Production non certifiée** tant que les dépendances ne sont pas installées et que le vrai runtime LangGraph, Prisma/Neon, les fournisseurs IA et le build Next.js n'ont pas été validés ensemble.

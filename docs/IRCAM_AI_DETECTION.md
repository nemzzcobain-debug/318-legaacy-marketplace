# Détection audio IA — IRCAM Amplify

Le dashboard administrateur peut envoyer, uniquement après confirmation manuelle, le fichier audio
d'un beat à l'API **AI Music Detector v2** d'IRCAM Amplify.

## Configuration

Ajouter côté serveur dans Vercel :

```text
IRCAM_AMPLIFY_API_TOKEN=<jeton JWT IRCAM>
IRCAM_AMPLIFY_API_URL=https://api.ircamamplify.io
```

Le jeton ne doit jamais être exposé dans une variable `NEXT_PUBLIC_*` ni commité dans Git.

## Fonctionnement

1. L'administrateur ouvre la fiche détaillée du beat.
2. Il confirme l'envoi temporaire du fichier à IRCAM.
3. Le serveur génère une URL Supabase signée valable une heure.
4. IRCAM analyse le fichier de façon asynchrone.
5. Le dashboard affiche la probabilité IA, le modèle suspecté et les versions disponibles.

Un résultat élevé place le beat en contrôle prioritaire, mais **ne le refuse et ne le supprime
jamais automatiquement**. La décision finale reste humaine et peut inclure une demande de projet
DAW, de MIDI, de stems ou de démonstration en direct.

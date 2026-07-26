# Surveillance opérationnelle

La marketplace surveille désormais automatiquement :

- les erreurs critiques remontées par le navigateur ;
- les échecs de signature ou de traitement du webhook Stripe ;
- les échecs d'envoi Resend et les configurations email manquantes ;
- la base de données et la configuration des services toutes les 10 minutes.

## Alertes

Les incidents sont toujours écrits dans les logs structurés Vercel. Ils peuvent
aussi être envoyés :

- sur `NTFY_MONITORING_TOPIC` (ou `NTFY_TOPIC` en secours) ;
- vers un workflow n8n/Slack avec `MONITORING_WEBHOOK_URL`.

Les alertes identiques sont limitées à une toutes les deux minutes pour éviter
un déluge de notifications. Les secrets, tokens, cookies et données de carte
sont masqués avant journalisation.

## Points de contrôle

- `GET /api/health` : état synthétique pour un outil d'uptime ;
- `GET /api/monitoring/check` : contrôle détaillé protégé par `CRON_SECRET` ;
- le cron Vercel appelle le contrôle détaillé toutes les 10 minutes.

## Configuration minimale

Définir dans Vercel :

```text
CRON_SECRET
RESEND_API_KEY
EMAIL_FROM
STRIPE_WEBHOOK_SECRET
NTFY_MONITORING_TOPIC
```

`MONITORING_WEBHOOK_URL` et `MONITORING_WEBHOOK_SECRET` sont optionnels si ntfy
est déjà configuré.

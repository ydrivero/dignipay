# DigniPay Phase 1 MVP

A local-first demo platform for dignified digital giving.

## One-command run (local)

```bash
./run.sh
```

The server will start at http://localhost:3000.

## Run in Docker

Build the image:

```bash
docker build -t dignipay .
```

Run the container:

```bash
docker run --rm -p 3000:3000 dignipay
```

Then open http://localhost:3000.

## What is included

- Donor QR flow with category-based giving and optional tips.
- Shelter admin portal for onboarding participants and printing badges.
- Wallet tracking with live stats and recent donations.
## Run in Docker (one command)

```bash
docker compose up --build
```

Then open http://localhost:3000.

Optional: copy `.env.example` to `.env` to enable Stripe and SMTP settings. The app runs without it.

## Configure Stripe payments (optional)

1. Copy `.env.example` to `.env`.
2. Set `STRIPE_SECRET_KEY` with a Stripe test secret key.
3. Restart the app. Donor checkout will redirect to Stripe and return to `/donate/success`.

## Configure email receipts (optional)

1. Copy `.env.example` to `.env`.
2. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `RECEIPT_EMAIL_FROM`.
3. Set `SMTP_SECURE=true` if your server requires TLS on connect (commonly port 465).
4. Restart the app. Receipts will be emailed when donors provide an email address.

## City reporting exports

Visit the City Report page to refresh metrics and download exports:

- Report UI: http://localhost:3000/admin/reporting-page
- CSV: http://localhost:3000/admin/reporting.csv
- PDF: http://localhost:3000/admin/reporting.pdf

## What is included

- Donor QR flow with category-based giving, optional tips, and receipts.
- Shelter admin portal for onboarding participants and printing badges.
- City reporting dashboard with anonymized exports.
- Community pool ledger for non-badge support.

## Demo links

- Home: http://localhost:3000
- Shelter portal: http://localhost:3000/admin
- Donor demo: http://localhost:3000/donate/demo

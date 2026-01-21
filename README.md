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

## Demo links

- Home: http://localhost:3000
- Shelter portal: http://localhost:3000/admin
- Donor demo: http://localhost:3000/donate/demo

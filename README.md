# Binance Relay Server

A tiny Node.js relay that lets Lovable Cloud edge functions call Binance through a **static, whitelistable IP address**.

---

## Why?

Lovable Cloud (Supabase Edge Functions) uses dynamic outbound IPs. Binance API Management lets you whitelist IPs for extra security. This relay bridges them.

```
Lovable Edge Function  →  THIS RELAY (static IP)  →  Binance
   (dynamic IPs)            (whitelist this IP)
```

---

## Deployment Options (পছন্দ একটা)

### Option A: Fly.io (FREE, always-on, recommended)

1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. `cd binance-relay && fly launch --no-deploy` → choose region (Singapore = `sin`)
3. Set secrets:
   ```bash
   fly secrets set RELAY_SECRET="<generate a long random string>"
   fly secrets set BINANCE_API_KEY="<your binance api key>"
   fly secrets set BINANCE_API_SECRET="<your binance api secret>"
   ```
4. Allocate dedicated IPv4 (free for one app):
   ```bash
   fly ips allocate-v4
   ```
   → Copy the IP shown. **This is what you whitelist on Binance.**
5. Deploy: `fly deploy`
6. Test: `curl https://<your-app>.fly.dev/healthz`

### Option B: Railway

1. Create account at railway.app → New Project → Deploy from GitHub
2. Connect this repo and pick the `binance-relay/` folder as root
3. In Variables tab, set: `RELAY_SECRET`, `BINANCE_API_KEY`, `BINANCE_API_SECRET`
4. Settings → Networking → enable **Static Outbound IP**
5. Copy the static IP and whitelist on Binance

### Option C: Render

1. render.com → New → Web Service → connect repo → root = `binance-relay`
2. Environment: add `RELAY_SECRET`, `BINANCE_API_KEY`, `BINANCE_API_SECRET`
3. After deploy, go to Settings → find "Outbound IP Addresses" → copy
4. Whitelist on Binance
5. ⚠️ Free tier sleeps after 15 min idle. Use UptimeRobot to ping `/healthz` every 5 min.

---

## After Deployment

1. **Whitelist the static IP** in Binance → API Management → Edit restrictions
2. **Test it**:
   ```bash
   curl -X POST https://your-relay.fly.dev/binance/account \
     -H "x-relay-secret: YOUR_RELAY_SECRET"
   ```
   Should return your Binance account info.

3. **Give Lovable these two values** so it can be wired in:
   - `BINANCE_RELAY_URL` = `https://your-relay.fly.dev`
   - `BINANCE_RELAY_SECRET` = the `RELAY_SECRET` you set

---

## Endpoints

| Method | Path                       | Purpose                                    |
|--------|----------------------------|--------------------------------------------|
| GET    | `/healthz`                 | Liveness check (no auth)                   |
| GET    | `/whoami`                  | Returns the relay's outbound IP            |
| POST   | `/binance/server-time`     | Connectivity test                          |
| POST   | `/binance/account`         | Account info — proves IP whitelist works   |
| POST   | `/binance/pay/bill-list`   | Binance Pay bill list (deposit verification) |

All endpoints except `/healthz` require header `x-relay-secret`.

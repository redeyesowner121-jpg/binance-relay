# Static IP Setup for Binance Relay

## Why Static IP is Needed

Binance requires whitelisting IP addresses for API access. This relay server needs a static IP so you can add it to your Binance API key whitelist.

## Fly.io Static IP Setup

### Step 1: Allocate Static IP Addresses

After deploying your app to Fly.io, run these commands:

```bash
fly ips allocate-v4
fly ips allocate-v6
```

This will return your static IP addresses. Save them.

### Step 2: View Your Static IPs

```bash
fly ips list
```

### Step 3: Add Static IP to Binance

1. Log into your Binance account
2. Go to API Management
3. Edit your API key settings
4. Add the IPv4 address from Step 1 to the IP whitelist
5. Save changes

### Step 4: Verify Setup

Test your relay server:

```bash
curl https://binance-relay.fly.dev/healthz
```

Or get the server's outbound IP:

```bash
curl https://binance-relay.fly.dev/whoami
```

The IP returned should match your allocated static IP.

## Important Notes

- **Never use `fly ips release`** - this will free your static IP
- The static IP remains assigned to your app until you explicitly release it
- The `min_machines_running = 1` in fly.toml ensures your app never sleeps
- `auto_stop_machines = false` keeps the machine running

## Testing Binance API Access

```bash
curl -X POST https://binance-relay.fly.dev/binance/account \
  -H "Content-Type: application/json" \
  -H "x-relay-secret: ASIF_REPLIT123"
```

If successful, this returns your Binance account information.

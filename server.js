// Binance Relay Server
// -----------------------------------------------------------------------------
// Purpose: Lovable Cloud edge functions have DYNAMIC outbound IPs and cannot be
// whitelisted on Binance. This tiny relay sits on a host with a STATIC IP
// (Fly.io / Railway / Render) and forwards signed requests to Binance.
//
// Lovable -> [HTTPS + shared-secret] -> THIS SERVER -> [signed] -> Binance
//
// Endpoints exposed:
//   GET  /healthz                       -> liveness check
//   POST /binance/account               -> /api/v3/account (signed GET)
//   POST /binance/server-time           -> /api/v3/time
//   POST /binance/pay/bill-list         -> Binance Pay /bill/list (signed POST)
//
// Every request from Lovable MUST include header `x-relay-secret: <RELAY_SECRET>`.
// -----------------------------------------------------------------------------

import express from "express";
import crypto from "node:crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8080;
const RELAY_SECRET = process.env.RELAY_SECRET;
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;

if (!RELAY_SECRET || !BINANCE_API_KEY || !BINANCE_API_SECRET) {
  console.error("❌ Missing env vars: RELAY_SECRET, BINANCE_API_KEY, BINANCE_API_SECRET");
  process.exit(1);
}

// --- Auth middleware ---------------------------------------------------------
function requireSecret(req, res, next) {
  if (req.path === "/healthz") return next();
  const got = req.header("x-relay-secret");
  if (!got || got !== RELAY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
app.use(requireSecret);

// --- Helpers -----------------------------------------------------------------
function hmac(algo, secret, message) {
  return crypto.createHmac(algo, secret).update(message).digest("hex");
}

// --- Routes ------------------------------------------------------------------
app.get("/healthz", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Get outbound IP (handy for whitelisting setup)
app.get("/whoami", async (_req, res) => {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    res.json(j);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Binance Spot: server time
app.post("/binance/server-time", async (_req, res) => {
  try {
    const r = await fetch("https://api.binance.com/api/v3/time");
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

// Binance Spot: account info (tests API key + IP whitelist)
app.post("/binance/account", async (_req, res) => {
  try {
    const timestamp = Date.now();
    const qs = `timestamp=${timestamp}`;
    const sig = hmac("sha256", BINANCE_API_SECRET, qs);
    const r = await fetch(`https://api.binance.com/api/v3/account?${qs}&signature=${sig}`, {
      headers: { "X-MBX-APIKEY": BINANCE_API_KEY },
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

// Binance Pay: bill list (used by verify-binance-payment)
app.post("/binance/pay/bill-list", async (req, res) => {
  try {
    const { startTimestamp, endTimestamp, limit } = req.body || {};
    const body = JSON.stringify({
      startTimestamp: Number(startTimestamp) || Date.now() - 30 * 86400_000,
      endTimestamp: Number(endTimestamp) || Date.now(),
      limit: Number(limit) || 100,
    });
    const timestamp = Date.now();
    const nonce = crypto.randomUUID().replace(/-/g, "").substring(0, 32);
    const payload = `${timestamp}\n${nonce}\n${body}\n`;
    const signature = hmac("sha512", BINANCE_API_SECRET, payload).toUpperCase();

    const r = await fetch("https://bpay.binanceapi.com/binancepay/openapi/v3/bill/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": String(timestamp),
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": BINANCE_API_KEY,
        "BinancePay-Signature": signature,
      },
      body,
    });
    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Binance relay listening on :${PORT}`);
});

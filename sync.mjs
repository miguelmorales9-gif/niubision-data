const REST =
  "https://api.restful-api.dev/objects/ff808181a067127101a09d8c8a530e21";
const FILE = "studio.json";
const fs = await import("node:fs");

function asWrap(raw) {
  if (!raw || typeof raw !== "object") return null;
  const inner = raw.data && raw.data.state ? raw.data : raw;
  const state = inner.state && typeof inner.state === "object" ? inner.state : inner;
  if (!state || typeof state !== "object") return null;
  return {
    studioKey: String(inner.studioKey || state.settings?.studioKey || "NIUBI"),
    token: String(inner.token || "nb-cloud-v1"),
    state,
    updatedAt: Number(inner.updatedAt || state.updatedAt || 0),
    id: "github",
  };
}

function keyOf(c) {
  if (c.id) return "id:" + c.id;
  if (c.accessCode) return "a:" + c.accessCode;
  if (c.phone) return "p:" + String(c.phone).replace(/\D/g, "");
  return "n:" + String(c.name || "").toLowerCase();
}

function merge(a, b) {
  if (!a) return b;
  if (!b) return a;
  const aAt = Number(a.updatedAt || 0);
  const bAt = Number(b.updatedAt || 0);
  const newer = bAt >= aAt ? b : a;
  const older = newer === b ? a : b;
  const map = new Map();
  []
    .concat(older.state?.clients || [], newer.state?.clients || [])
    .forEach((c) => {
      if (!c) return;
      const prev = map.get(keyOf(c)) || {};
      map.set(keyOf(c), Object.assign({}, prev, c));
    });
  const pay = new Map();
  []
    .concat(older.state?.payments || [], newer.state?.payments || [])
    .forEach((p) => {
      if (!p) return;
      pay.set(String(p.id || p.date + p.name), Object.assign({}, pay.get(String(p.id || p.date + p.name)) || {}, p));
    });
  const inbox = new Map();
  []
    .concat(older.state?.inbox || [], newer.state?.inbox || [])
    .forEach((i) => {
      if (!i) return;
      inbox.set(String(i.id || i.type + i.clientId + i.at), i);
    });
  const contracts = new Map();
  []
    .concat(older.state?.contracts || [], newer.state?.contracts || [])
    .forEach((k) => {
      if (!k) return;
      contracts.set(String(k.id || k.clientId || k.name), k);
    });
  const revoked = [];
  const seen = new Set();
  []
    .concat(older.state?.revoked || [], newer.state?.revoked || [])
    .forEach((r) => {
      const k = String(r.code || "") + "|" + String(r.clientId || "");
      if (k === "|" || seen.has(k)) return;
      seen.add(k);
      revoked.push(r);
    });
  const state = Object.assign({}, older.state, newer.state, {
    clients: Array.from(map.values()),
    payments: Array.from(pay.values()),
    inbox: Array.from(inbox.values()).sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, 80),
    contracts: Array.from(contracts.values()),
    revoked,
    updatedAt: Math.max(aAt, bAt, Date.now()),
  });
  return {
    studioKey: newer.studioKey || older.studioKey || "NIUBI",
    token: newer.token || older.token || "nb-cloud-v1",
    state,
    updatedAt: state.updatedAt,
    id: "github",
  };
}

const local = asWrap(JSON.parse(fs.readFileSync(FILE, "utf8")));
let remote = null;
try {
  const res = await fetch(REST, { headers: { Accept: "application/json" } });
  if (res.ok) remote = asWrap(await res.json());
} catch {
  /* live buffer may be down */
}
const out = merge(local, remote);
fs.writeFileSync(FILE, JSON.stringify(out));
if (remote && Number(remote.updatedAt || 0) < Number(out.updatedAt || 0)) {
  try {
    await fetch(REST, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: "niubision", data: out }),
    });
  } catch {
    /* ignore */
  }
}
console.log("cloud synced", (out.state.clients || []).length, "clients", out.updatedAt);

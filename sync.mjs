const WORKER = "https://niubision-api.miguel-morales9.workers.dev";
const FILE = "studio.json";
const fs = await import("node:fs");

function asWrap(raw) {
  if (!raw || typeof raw !== "object") return null;
  const state = raw.state && typeof raw.state === "object" ? raw.state : raw;
  if (!state || typeof state !== "object") return null;
  return {
    studioKey: "NIUBI",
    updatedAt: Number(raw.updatedAt || state.updatedAt || Date.now()),
    state,
    id: "github"
  };
}

const pin = process.env.NB_EXPORT_PIN || "9798";
const tok = process.env.NB_CLOUD_TOKEN || "nb-cloud-v1";
let remote = null;
try {
  let res = await fetch(WORKER + "/api/export?pin=" + encodeURIComponent(pin), {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    res = await fetch(WORKER + "/api/state", {
      headers: { Accept: "application/json", Authorization: "Bearer " + tok }
    });
  }
  if (res.ok) remote = asWrap(await res.json());
} catch {
  /* worker may be down */
}

if (!remote) {
  console.log("no remote, keep local");
  process.exit(0);
}

let local = null;
try {
  local = asWrap(JSON.parse(fs.readFileSync(FILE, "utf8")));
} catch {
  local = null;
}

const aAt = Number((local && local.updatedAt) || 0);
const bAt = Number(remote.updatedAt || 0);
const out = bAt >= aAt || !local ? remote : local;
if (JSON.stringify(out) !== JSON.stringify(local)) {
  fs.writeFileSync(FILE, JSON.stringify(out));
  console.log("cloud backup", (out.state.clients || []).length, "clients", out.updatedAt);
} else {
  console.log("cloud backup unchanged");
}

import React, { useState } from "react";

/**
 * App.jsx — version me auto-retry kur serveri është në cold start (Render),
 * me kontroll strikt të JSON-it, dhe me upload single/multi + schedule.
 *
 * KËTU S'KA NEVOJË TË PREKËSH ASNJË GJË, VETËM SIGURO VITE_API_URL TE VERCEL.
 */

// ==== API base nga .env (Vercel) ====
const API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// ==== helper i përgjithshëm: lexon JSON, por nëse vjen HTML (cold start) bën retry ====
async function jsonFetch(url, opts = {}, retries = 2) {
  const res = await fetch(url, opts);
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  if (!ct.includes("application/json")) {
    // morëm HTML (p.sh. “Application loading…”)
    const body = await res.text();
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1200));
      return jsonFetch(url, opts, retries - 1);
    }
    const snippet = body.slice(0, 250).replace(/\s+/g, " ");
    throw new Error(`HTTP ${res.status} — Non-JSON response: ${snippet}`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

// ngroh serverin para kërkesave (redukton shanset për HTML splash)
async function ensureWarm() {
  if (!API) throw new Error("VITE_API_URL mungon në Vercel.");
  try { await jsonFetch(`${API}/health`, {}, 1); } catch {}
}

// Llogarit kohën + orarin në ISO nga input datetime-local
function toISO(dtLocal) {
  // dtLocal p.sh. "2025-10-30T20:42"
  if (!dtLocal) return "";
  const d = new Date(dtLocal);
  // nëse duash UTC: return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString()
  return d.toISOString();
}

// llogarit intervale bulk
function buildTimes(startISO, count, everyHours) {
  const times = [];
  const base = new Date(startISO);
  for (let i = 0; i < count; i++) {
    const t = new Date(base.getTime() + i * everyHours * 3600 * 1000);
    times.push(t.toISOString());
  }
  return times;
}

// nëse ke më shumë llogari, shtoji këtu
const ACCOUNTS = [
  { id: "aurora", label: "Aurora" },
  { id: "novara", label: "Novara" },
  { id: "selena", label: "Selena" },
  { id: "cynara", label: "Cynara" },
];

export default function App() {
  const [account, setAccount] = useState(ACCOUNTS[0].id);
  const [caption, setCaption] = useState("");

  // single upload / manual url (për test të shpejtë)
  const [externalUrl, setExternalUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // multi
  const [files, setFiles] = useState([]);
  const [when, setWhen] = useState("");            // datetime-local
  const [everyHours, setEveryHours] = useState(8); // intervali për bulk

  const [isUploading, setIsUploading] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text: string }

  // ===== Single upload (për prova të shpejta) =====
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMsg(null);
    try {
      await ensureWarm();

      const form = new FormData();
      form.append("image", file);

      const data = await jsonFetch(`${API}/upload`, { method: "POST", body: form });
      setImageUrl(data.url || "");
      setMsg({ type: "ok", text: "File u ngarkua." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setIsUploading(false);
    }
  }

  // ===== Multi-upload (opcional, nëse do me i pre-upload-u) =====
  async function handleMultiFiles(e) {
    const f = [...(e.target.files || [])];
    setFiles(f);

    if (!f.length) return;
    setIsUploading(true);
    setMsg(null);
    try {
      await ensureWarm();

      const form = new FormData();
      f.forEach(file => form.append("images", file));

      const data = await jsonFetch(`${API}/upload-multi`, { method: "POST", body: form });
      // e ruajmë të parën te imageUrl për një test të shpejtë
      if (data.files?.length) {
        setImageUrl(data.files[0].url);
      }
      setMsg({ type: "ok", text: `U ngarkuan ${data.files?.length || 0} file.` });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setIsUploading(false);
    }
  }

  // ===== Schedule një post =====
  async function handleScheduleOne(e) {
    e.preventDefault();
    setMsg(null);

    const finalImageUrl = imageUrl?.trim() || externalUrl?.trim();
    if (!finalImageUrl) return setMsg({ type: "err", text: "Vendos foto/video (upload ose URL)." });
    if (!when) return setMsg({ type: "err", text: "Zgjedh kohën." });

    try {
      await ensureWarm();

      const payload = {
        account,
        caption,
        imageUrl: finalImageUrl,
        when: toISO(when),
      };

      await jsonFetch(`${API}/posts/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMsg({ type: "ok", text: "✅ Post u planifikua me sukses." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }

  // ===== Schedule bulk =====
  async function handleScheduleBulk(e) {
    e.preventDefault();
    setMsg(null);

    // Manual URLs (një për rresht) – nëse do ta shtosh, mund ta shtosh si textarea.
    // Për thjeshtësi, përdorim files e selektuara: nëse s’i pre-upload-on, dërgon si multipart te /bulk.
    if (!files.length) return setMsg({ type: "err", text: "Zgjedh disa file." });
    if (!when) return setMsg({ type: "err", text: "Zgjedh kohën e nisjes." });

    try {
      await ensureWarm();

      const startISO = toISO(when);
      const times = buildTimes(startISO, files.length, Number(everyHours) || 8);

      // Dërgojmë si multipart drejt /bulk (serveri yt e pranon sipas kodit të ri server.mjs)
      const form = new FormData();
      files.forEach(f => form.append("images", f));
      form.append("account", account);
      form.append("caption", caption);
      form.append("times", JSON.stringify(times)); // ISO strings

      await jsonFetch(`${API}/bulk`, { method: "POST", body: form });

      setMsg({ type: "ok", text: `✅ ${files.length} poste u planifikuan.` });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Instagram Scheduler Admin</h1>

        {/* Info diag për debug */}
        <div className="text-xs text-gray-500 mb-4">
          API: {API || "(no VITE_API_URL)"} <br />
        </div>

        {/* ===== Forma për një post ===== */}
        <form onSubmit={handleScheduleOne} className="bg-white rounded-xl shadow p-6 space-y-5 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            >
              {ACCOUNTS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="Write your caption…"
            />
          </div>

          {/* Upload 1 file për test */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Choose file (single)</label>
            <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="block w-full" />
            {isUploading && <p className="text-sm text-gray-500 mt-1">Uploading…</p>}
            {imageUrl && (
              <p className="text-xs text-gray-500 mt-1">
                Uploaded URL: <span className="underline">{imageUrl}</span>
              </p>
            )}
          </div>

          {/* Ose URL manuale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image/Video URL (optional)</label>
            <input
              type="text"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publish time</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
            >
              {isUploading ? "Uploading…" : "Schedule"}
            </button>
          </div>

          {msg && (
            <p className={msg.type === "ok" ? "text-sm text-green-600" : "text-sm text-red-600"}>
              {msg.text}
            </p>
          )}
        </form>

        {/* ===== Forma për BULK ===== */}
        <form onSubmit={handleScheduleBulk} className="bg-white rounded-xl shadow p-6 space-y-5">
          <h2 className="text-lg font-semibold">Schedule BULK</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Choose files (multi)</label>
            <input multiple type="file" accept="image/*,video/*" onChange={handleMultiFiles} className="block w-full" />
            <p className="text-xs text-gray-500 mt-1">{files.length} files selected</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interval (hours)</label>
              <input
                type="number"
                min="1"
                value={everyHours}
                onChange={(e) => setEveryHours(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
            >
              {isUploading ? "Uploading…" : "Schedule BULK"}
            </button>
          </div>

          {msg && (
            <p className={msg.type === "ok" ? "text-sm text-green-600" : "text-sm text-red-600"}>
              {msg.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

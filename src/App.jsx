import React, { useState } from "react";

/**
 * Admin ngjashëm me botin tënd:
 * - Zgjedh llogarinë (Aurora/Novara/Selena/Cynara)
 * - Multi file upload (kthen URL-t nga serveri)
 * - Ose URL manuale (opsionale)
 * - Fillon nga një orë (startAt) dhe poston çdo X orë (intervalHours)
 * - SCHEDULE BULK (POST /posts/schedule-bulk)
 *
 * Kërkon: VITE_API_URL të saktë (Render) p.sh. https://insta-scheduler-server.onrender.com
 */

const API_URL = import.meta.env.VITE_API_URL;

const ACCOUNTS = [
  { id: "aurora", label: "Aurora" },
  { id: "novara", label: "Novara" },
  { id: "selena", label: "Selena" },
  { id: "cynara", label: "Cynara" },
];

export default function App() {
  const [account, setAccount] = useState(ACCOUNTS[0].id);
  const [caption, setCaption] = useState("");
  const [manualUrls, setManualUrls] = useState(""); // një URL për rresht (opsionale)
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const [isUploading, setIsUploading] = useState(false);

  // koha e nisjes dhe intervali (si tek boti yt)
  const [startAt, setStartAt] = useState("");           // datetime-local
  const [intervalHours, setIntervalHours] = useState(3); // p.sh. çdo 3 orë

  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text: string }

  function toISO(dtLocal) {
    // nga input datetime-local -> ISO UTC
    if (!dtLocal) return "";
    const d = new Date(dtLocal);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  }

  async function uploadAllSelected() {
    if (!selectedFiles.length) return [];
    setIsUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      for (const f of selectedFiles) form.append("images", f); // MULTI
      const res = await fetch(`${API_URL}/upload-multi`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      // kthen [{url, name}]…
      return (data?.files || []).map(x => x.url).filter(Boolean);
    } catch (err) {
      setMsg({ type: "err", text: err.message });
      return [];
    } finally {
      setIsUploading(false);
    }
  }

  async function handleScheduleBulk(e) {
    e.preventDefault();
    setMsg(null);

    // 1) mbledhim url-t nga upload + manualet
    const uploadedUrls = await uploadAllSelected();
    const manualList = (manualUrls || "")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    const allUrls = [...uploadedUrls, ...manualList];
    if (!allUrls.length) {
      setMsg({ type: "err", text: "Vendos foto/video (upload ose URL)!" });
      return;
    }

    if (!startAt) {
      setMsg({ type: "err", text: "Vendos start time (datetime)!" });
      return;
    }
    const startISO = toISO(startAt);
    const everyHours = Math.max(1, Number(intervalHours || 1));

    // 2) ndërto payloadin për bulk
    const jobs = allUrls.map((url, i) => ({
      account,
      caption,
      imageUrl: url,
      when: new Date(new Date(startISO).getTime() + i * everyHours * 3600_000).toISOString(),
    }));

    try {
      const res = await fetch(`${API_URL}/posts/schedule-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Scheduling failed");
      setMsg({ type: "ok", text: `✅ ${jobs.length} poste u planifikuan.` });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Instagram Scheduler Admin</h1>

        <form onSubmit={handleScheduleBulk} className="bg-white rounded-xl shadow p-6 space-y-5">
          {/* Account */}
          <div>
            <label className="block text-sm font-medium mb-1">Account</label>
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

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium mb-1">Caption</label>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="Write your caption…"
            />
          </div>

          {/* Multi file */}
          <div>
            <label className="block text-sm font-medium mb-1">Choose files (multi)</label>
            <input type="file" accept="image/*,video/*" multiple onChange={handleFiles} />
            {isUploading && <p className="text-sm text-gray-500 mt-1">Uploading…</p>}
          </div>

          {/* Manual URLs (optional) */}
          <div>
            <label className="block text-sm font-medium mb-1">Manual URLs (opsionale, një për rresht)</label>
            <textarea
              rows={3}
              value={manualUrls}
              onChange={(e) => setManualUrls(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder={"https://.../1.jpg\nhttps://.../2.mp4"}
            />
          </div>

          {/* Scheduling controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start time</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Interval (hours)</label>
              <input
                type="number"
                min={1}
                value={intervalHours}
                onChange={(e) => setIntervalHours(e.target.value)}
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

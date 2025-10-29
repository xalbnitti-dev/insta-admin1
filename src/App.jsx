import React, { useState } from "react";

/**
 * Vendos VITE_API_URL te Vercel = https://insta-scheduler-server.onrender.com
 * (pa slash në fund)
 */
const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:5000";

const ACCOUNTS = [
  { id: "aurora", label: "Aurora" },
  { id: "novara", label: "Novara" },
  { id: "selena", label: "Selena" },
  { id: "cynara", label: "Cynara" },
];

export default function App() {
  const [account, setAccount] = useState(ACCOUNTS[0].id);
  const [caption, setCaption] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMsg(null);

    try {
      const form = new FormData();
      // EMRI I FUSHËS DUHET TË JETË "image" — përputhet me serverin
      form.append("image", file);

      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: form,
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Serveri ktheu përgjigje jo-JSON (mos po godet domain-in e gabuar?).");
      }

      if (!res.ok) throw new Error(data?.error || "Upload failed");
      setImageUrl(data.url || "");
      setMsg({ type: "ok", text: "Foto u ngarkua." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);

    const finalImageUrl = imageUrl?.trim() || externalUrl?.trim();
    if (!finalImageUrl) return setMsg({ type: "err", text: "Vendos një foto (upload ose URL)." });
    if (!when) return setMsg({ type: "err", text: "Zgjedh kohën e publikimit." });

    try {
      const res = await fetch(`${API_URL}/posts/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, caption, imageUrl: finalImageUrl, when }),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("Serveri ktheu përgjigje jo-JSON."); }
      if (!res.ok) throw new Error(data?.error || "Scheduling failed");

      setMsg({ type: "ok", text: "✅ Posti u planifikua me sukses." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Instagram Scheduler Admin</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-5">
          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full border px-3 py-2 rounded">
              {ACCOUNTS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
            <textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="Write your caption…" />
          </div>

          {/* Upload file */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Choose file</label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full" />
            {isUploading && <p className="text-sm text-gray-500 mt-1">Uploading…</p>}
            {imageUrl && <p className="text-xs text-gray-500 mt-1">Uploaded URL: <span className="underline">{imageUrl}</span></p>}
          </div>

          {/* Ose URL manuale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
            <input type="text" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" className="w-full border px-3 py-2 rounded" />
          </div>

          {/* Koha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publish time</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>

          <div className="pt-2">
            <button type="submit" disabled={isUploading} className="px-4 py-2 rounded bg-black text-white disabled:opacity-60">
              {isUploading ? "Uploading…" : "Schedule"}
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

import React, { useState } from "react";

/**
 * Frontend i thjeshtë për:
 *  - Zgjedhje llogarie (placeholder)
 *  - Caption
 *  - Upload file (POST /upload) dhe auto-mbushje të Image URL
 *  - Ose futje manuale të një Image URL
 *  - Zgjedhje kohe (datetime-local)
 *  - SCHEDULE (POST /posts/schedule)
 *
 * Kërkon që të kesh VITE_API_URL të vendosur te Vercel (p.sh. https://insta-scheduler-server.vercel.app)
 */

const API_URL = import.meta.env.VITE_API_URL;

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
  const [externalUrl, setExternalUrl] = useState(""); // URL manuale
  const [imageUrl, setImageUrl] = useState("");       // URL nga upload
  const [isUploading, setIsUploading] = useState(false);
  const [when, setWhen] = useState(""); // datetime-local
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text: string }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");

      // Auto-mbushe fushën me url-në e kthyer nga serveri
      setImageUrl(data.url || "");
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);

    // prioritet: imageUrl nga upload, përndryshe externalUrl manuale
    const finalImageUrl = imageUrl?.trim() || externalUrl?.trim();
    if (!finalImageUrl) {
      setMsg({ type: "err", text: "Vendos një foto (upload ose URL)." });
      return;
    }
    if (!when) {
      setMsg({ type: "err", text: "Zgjedh kohën e publikimit." });
      return;
    }

    try {
      const payload = {
        account,            // p.sh. "aurora"
        caption,
        imageUrl: finalImageUrl,
        when,               // vlera nga input type="datetime-local"
      };

      const res = await fetch(`${API_URL}/posts/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Scheduling failed");

      setMsg({ type: "ok", text: "✅ Post u planifikua me sukses." });
      // reset të lehtë (lë account-in të pandryshuar)
      // setCaption(""); setExternalUrl(""); setImageUrl(""); setWhen("");
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Instagram Scheduler Admin</h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow p-6 space-y-5"
        >
          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account
            </label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            >
              {ACCOUNTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caption
            </label>
            <textarea
              rows={5}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="Write your caption…"
            />
          </div>

          {/* Upload file */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Choose file
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full"
            />
            {isUploading && (
              <p className="text-sm text-gray-500 mt-1">Uploading…</p>
            )}
          </div>

          {/* Ose URL manuale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image URL (optional, used if no uploaded file)
            </label>
            <input
              type="text"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border px-3 py-2 rounded"
            />
            {/* kur ka ardhur URL nga upload, e shfaqim dhe e përdorim */}
            {imageUrl && (
              <p className="text-xs text-gray-500 mt-1">
                Uploaded URL: <span className="underline">{imageUrl}</span>
              </p>
            )}
          </div>

          {/* Koha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publish time
            </label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
            >
              {isUploading ? "Uploading…" : "Schedule"}
            </button>
          </div>

          {/* Status */}
          {msg && (
            <p
              className={
                msg.type === "ok"
                  ? "text-sm text-green-600"
                  : "text-sm text-red-600"
              }
            >
              {msg.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

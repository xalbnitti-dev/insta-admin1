import React, { useMemo, useState } from "react";

/**
 * UI i thjeshtë për:
 *  - Zgjedhje llogarie (Aurora/Novara/Selena/Cynara)
 *  - Caption
 *  - Upload multi-file (POST /upload-multi) → merr URL-t nga serveri
 *  - Ose ngjit URL (një për rresht)
 *  - Koha e publikimit (datetime-local) + opsion për përsëritje (p.sh. çdo 3 orë, N herë)
 *  - Schedule Bulk (POST /posts/schedule-bulk) me 'x-admin-key'
 *
 * Kërkon env var:
 *  VITE_API_URL
 *  VITE_ADMIN_API_KEY
 */

const API_URL = import.meta.env.VITE_API_URL;
const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY;

// definon llogaritë që do të shfaqen te dropdown
const ACCOUNTS = [
  { id: "aurora", label: "Aurora" },
  { id: "novara", label: "Novara" },
  { id: "selena", label: "Selena" },
  { id: "cynara", label: "Cynara" },
];

// helper: konverton nga "datetime-local" në ISO me offset të saktë të zonës kohore të përdoruesit
function localDatetimeToISO(dtLocal) {
  // dtLocal p.sh. "2025-10-30T22:15"
  if (!dtLocal) return null;
  const d = new Date(dtLocal);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// gjeneron një listë kohësh me interval orësh
function generateTimes(startISO, count, everyHours) {
  const out = [];
  const start = new Date(startISO).getTime();
  const stepMs = Number(everyHours) * 3600 * 1000;
  for (let i = 0; i < Number(count); i++) {
    out.push(new Date(start + i * stepMs).toISOString());
  }
  return out;
}

export default function App() {
  const [account, setAccount] = useState(ACCOUNTS[0].id);
  const [caption, setCaption] = useState("");

  // URL-t që kthehen nga upload-multi
  const [uploadedUrls, setUploadedUrls] = useState([]);
  // Tekst nga futja manuale e URL-ve (një për rresht)
  const [externalUrlsText, setExternalUrlsText] = useState("");

  const [when, setWhen] = useState(""); // datetime-local
  const [repeatCount, setRepeatCount] = useState(1); // sa postime në seri
  const [repeatEveryHours, setRepeatEveryHours] = useState(3); // çdo sa orë

  const [isUploading, setIsUploading] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [msg, setMsg] = useState(null); // {type:'ok'|'err', text:string}

  const allImageUrls = useMemo(() => {
    const manual = externalUrlsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return [...uploadedUrls, ...manual];
  }, [uploadedUrls, externalUrlsText]);

  async function handleFilesChosen(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setMsg(null);
    setIsUploading(true);

    try {
      const form = new FormData();
      for (const f of files) form.append("images", f); // VERY IMPORTANT: 'images'
      const r = await fetch(`${API_URL}/upload-multi`, {
        method: "POST",
        body: form,
      });
      // nëse serveri kthen HTML (gabim routing), do dështojë këtu
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Upload failed");
      const urls = (data?.files || []).map((x) => x.url).filter(Boolean);
      if (!urls.length) throw new Error("No files parsed from response.");
      setUploadedUrls((prev) => [...prev, ...urls]);
      setMsg({ type: "ok", text: `✅ Ngarkuar ${urls.length} file.` });
    } catch (err) {
      setMsg({ type: "err", text: err.message || "Upload error" });
    } finally {
      setIsUploading(false);
      // reset input-in (lejon ngarkim me të njëjtin emër sërish)
      e.target.value = "";
    }
  }

  async function handleSchedule(e) {
    e.preventDefault();
    setMsg(null);

    if (!API_URL) {
      setMsg({ type: "err", text: "VITE_API_URL mungon te Vercel." });
      return;
    }
    if (!ADMIN_KEY) {
      setMsg({ type: "err", text: "VITE_ADMIN_API_KEY mungon te Vercel." });
      return;
    }

    const finalUrls = allImageUrls;
    if (!finalUrls.length) {
      setMsg({ type: "err", text: "Shto të paktën një foto/video (upload ose URL)." });
      return;
    }
    if (!when) {
      setMsg({ type: "err", text: "Zgjedh kohën e publikimit." });
      return;
    }

    // koha fillestare
    const startISO = localDatetimeToISO(when);
    if (!startISO) {
      setMsg({ type: "err", text: "Data/ora e pavlefshme." });
      return;
    }

    // nëse repeatCount > 1, gjenero seri kohësh
    const times =
      Number(repeatCount) > 1
        ? generateTimes(startISO, Number(repeatCount), Number(repeatEveryHours))
        : [startISO];

    // ndërto job-et: shpërndaji URL-t në kohë, rrotullim i thjeshtë
    const jobs = [];
    let u = 0;
    for (const t of times) {
      const url = finalUrls[u % finalUrls.length];
      u++;
      jobs.push({
        account,
        caption,
        imageUrl: url,
        when: t,
      });
    }

    try {
      setIsScheduling(true);
      const r = await fetch(`${API_URL}/posts/schedule-bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": ADMIN_KEY, // KY HEADER E SHPETON NGA "Unauthorized"
        },
        body: JSON.stringify({ jobs }),
      });
      const data = await r.json(); // nqs kthen HTML error, kjo do të hedhë gabim
      if (!r.ok) throw new Error(data?.error || "Scheduling failed");

      setMsg({
        type: "ok",
        text: `✅ U planifikuan ${data?.count ?? jobs.length} poste.`,
      });
      // Mund ta lëmë formën siç është që të planifikosh sërish me të njëjtat sete
    } catch (err) {
      setMsg({ type: "err", text: err.message || "Schedule error" });
    } finally {
      setIsScheduling(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Instagram Scheduler Admin</h1>

        <form
          onSubmit={handleSchedule}
          className="bg-white rounded-xl shadow p-6 space-y-6"
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

          {/* Upload multi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Choose files (multi)
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFilesChosen}
              className="block w-full"
            />
            {isUploading && (
              <p className="text-sm text-gray-500 mt-1">Uploading…</p>
            )}

            {/* Thumbnails / Listë URL */}
            {!!uploadedUrls.length && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-1">
                  Uploaded URLs ({uploadedUrls.length}):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {uploadedUrls.map((u, i) => (
                    <a
                      key={i}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="block border rounded overflow-hidden"
                      title={u}
                    >
                      {/* Për video s’provo të bësh thumbnail—thjesht shfaq link */}
                      {/\.(mp4|mov|m4v|webm)$/i.test(u) ? (
                        <div className="p-2 text-xs break-all">{u}</div>
                      ) : (
                        <img
                          src={u}
                          className="w-full h-24 object-cover"
                          onError={(e) => {
                            e.currentTarget.replaceWith(
                              Object.assign(document.createElement("div"), {
                                className: "p-2 text-xs break-all",
                                innerText: u,
                              })
                            );
                          }}
                        />
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual URLs (një për rresht) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image/Video URLs (optional; one per line)
            </label>
            <textarea
              rows={4}
              value={externalUrlsText}
              onChange={(e) => setExternalUrlsText(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="https://…\nhttps://…"
            />
            {!!allImageUrls.length && (
              <p className="text-xs text-gray-500 mt-1">
                Total selected: {allImageUrls.length}
              </p>
            )}
          </div>

          {/* Koha + përsëritje */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repeat count
              </label>
              <input
                type="number"
                min={1}
                value={repeatCount}
                onChange={(e) => setRepeatCount(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sa postime në seri (p.sh. 10).
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Every (hours)
              </label>
              <input
                type="number"
                min={1}
                value={repeatEveryHours}
                onChange={(e) => setRepeatEveryHours(e.target.value)}
                className="w-full border px-3 py-2 rounded"
                disabled={Number(repeatCount) <= 1}
              />
              <p className="text-xs text-gray-500 mt-1">
                Intervali mes postimeve (p.sh. 3).
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isUploading || isScheduling}
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
            >
              {isScheduling ? "Scheduling…" : "Schedule"}
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

        {/* Info serveri / debug të shpejtë */}
        <div className="mt-6 text-xs text-gray-500">
          <p>
            API: <code>{API_URL || "(missing VITE_API_URL)"}</code>
          </p>
          <p>
            Admin key present:{" "}
            <code>{ADMIN_KEY ? "yes" : "(missing VITE_ADMIN_API_KEY)"}</code>
          </p>
        </div>
      </div>
    </div>
  );
}

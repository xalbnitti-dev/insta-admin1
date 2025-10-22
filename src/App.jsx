import { useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL
const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY

export default function App() {
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [publishTime, setPublishTime] = useState('')
  const [account, setAccount] = useState('aurora')
  const [status, setStatus] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setStatus('Posting…')

    try {
      const res = await axios.post(
        `${API_URL}/schedule`,
        { caption, imageUrl, publishTime, account },
        { headers: { 'x-admin-api-key': ADMIN_KEY } }
      )
      setStatus(`✅ ${res.data?.message || 'Scheduled'}`)
    } catch (err) {
      setStatus(`❌ ${err.response?.data?.error || err.message}`)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Instagram Scheduler Admin</h1>

      <form onSubmit={submit} className="space-y-3 bg-white p-4 rounded-lg shadow">
        <label className="block">
          <span className="text-sm">Account</span>
          <select
            className="mt-1 w-full border rounded p-2"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="aurora">Aurora</option>
            <option value="selena">Selena</option>
            <option value="novara">Novara</option>
            <option value="cynara">Cynara</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm">Caption</span>
          <textarea
            className="mt-1 w-full border rounded p-2"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm">Image URL</span>
          <input
            className="mt-1 w-full border rounded p-2"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm">Publish time</span>
          <input
            type="datetime-local"
            className="mt-1 w-full border rounded p-2"
            value={publishTime}
            onChange={(e) => setPublishTime(e.target.value)}
          />
        </label>

        <button className="bg-black text-white px-4 py-2 rounded">Schedule</button>
      </form>

      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  )
}

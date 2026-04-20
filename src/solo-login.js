import './input.css'

const form = document.getElementById('login-form')
const usernameEl = document.getElementById('username')
const passwordEl = document.getElementById('password')
const errorEl = document.getElementById('error')
const submitEl = document.getElementById('submit')

function setError(message) {
  errorEl.textContent = message || ''
  errorEl.classList.toggle('hidden', !message)
}

async function checkSession() {
  const res = await fetch('/api/solo/session')
  if (res.ok) window.location.href = '/solo.html'
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  setError('')
  submitEl.disabled = true
  try {
    const res = await fetch('/api/solo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameEl.value, password: passwordEl.value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.message || 'Login failed')
      submitEl.disabled = false
      return
    }
    window.location.href = '/solo.html'
  } catch {
    setError('Network error')
    submitEl.disabled = false
  }
})

checkSession().catch(() => {})


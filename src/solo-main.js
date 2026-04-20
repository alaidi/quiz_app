import './input.css'

async function guard() {
  const res = await fetch('/api/solo/session')
  if (res.ok) return
  window.location.href = '/solo-login.html'
}

guard()
  .then(() => import('./quiz.js'))
  .catch(() => {
    window.location.href = '/solo-login.html'
  })


import './input.css'

async function guard() {
  const res = await fetch('/api/solo/session')
  if (res.ok) return
  window.location.href = '/login.html'
}

guard()
  .then(() => import('./quiz.js'))
  .catch(() => {
    window.location.href = '/login.html'
  })


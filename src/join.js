import './input.css'

const input = document.getElementById('room-code')
const joinA = document.getElementById('join-a')
const joinB = document.getElementById('join-b')
const err = document.getElementById('join-error')

function showError(message) {
  err.textContent = message
  err.classList.toggle('hidden', !message)
}

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}

function go(team) {
  const code = normalizeCode(input.value)
  if (!code) return showError('Enter room code')
  const url = new URL('/team.html', window.location.origin)
  url.searchParams.set('code', code)
  url.searchParams.set('team', team)
  window.location.href = url.toString()
}

input?.addEventListener('input', () => {
  input.value = normalizeCode(input.value)
  showError('')
})

joinA?.addEventListener('click', () => go('A'))
joinB?.addEventListener('click', () => go('B'))

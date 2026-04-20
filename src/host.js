import './input.css'
import { createSocket } from './realtime.js'
import QRCode from 'qrcode'

const roomEl = document.getElementById('room-code')
const copyBtn = document.getElementById('copy-room')
const openScreen = document.getElementById('open-screen')
const linksEl = document.getElementById('room-links')
const errEl = document.getElementById('host-error')
const lanUrlEl = document.getElementById('lan-url')
const qrJoin = document.getElementById('qr-join')
const qrA = document.getElementById('qr-a')
const qrB = document.getElementById('qr-b')

const teamAStatus = document.getElementById('team-a-status')
const teamBStatus = document.getElementById('team-b-status')
const teamASub = document.getElementById('team-a-sub')
const teamBSub = document.getElementById('team-b-sub')

const startBtn = document.getElementById('btn-start')
const revealBtn = document.getElementById('btn-reveal')
const nextBtn = document.getElementById('btn-next')
const resetBtn = document.getElementById('btn-reset')

const qProgress = document.getElementById('q-progress')
const bar = document.getElementById('bar')
const questionEl = document.getElementById('question')
const revealEl = document.getElementById('reveal')
const summaryEl = document.getElementById('summary')
const scoreAEl = document.getElementById('score-a')
const scoreBEl = document.getElementById('score-b')
const pyro = document.getElementById('pyro')

const LOG_KEY_PREFIX = 'quiz:host:answerLog:'
const HOST_ROOM_KEY = 'quiz:host:roomCode'
let publicBaseUrl = window.location.origin
let lastScores = { A: 0, B: 0 }
let pyroTimeout = null

function setError(message) {
  errEl.textContent = message || ''
  errEl.classList.toggle('hidden', !message)
}

async function loadServerInfo() {
  try {
    const res = await fetch('/api/info')
    const info = await res.json()
    if (info?.recommendedBaseUrl) publicBaseUrl = info.recommendedBaseUrl
  } catch {}
  if (lanUrlEl) lanUrlEl.textContent = publicBaseUrl
}

async function setQr(imgEl, url) {
  if (!imgEl) return
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 })
  imgEl.src = dataUrl
}

function setRoom(code) {
  roomEl.textContent = code || '----'
  if (!code) {
    linksEl.textContent = ''
    if (openScreen) openScreen.href = '/screen.html'
    return
  }

  const join = new URL('/index.html', publicBaseUrl)
  const screen = new URL('/screen.html', publicBaseUrl)
  screen.searchParams.set('code', code)
  const teamA = new URL('/team.html', publicBaseUrl)
  teamA.searchParams.set('code', code)
  teamA.searchParams.set('team', 'A')

  const teamB = new URL('/team.html', publicBaseUrl)
  teamB.searchParams.set('code', code)
  teamB.searchParams.set('team', 'B')

  linksEl.innerHTML = `
    <div class="mt-1">Team A: <span class="font-semibold">${teamA.toString()}</span></div>
    <div class="mt-1">Team B: <span class="font-semibold">${teamB.toString()}</span></div>
  `

  if (openScreen) openScreen.href = screen.toString()

  setQr(qrJoin, join.toString()).catch(() => {})
  setQr(qrA, teamA.toString()).catch(() => {})
  setQr(qrB, teamB.toString()).catch(() => {})
}

function pct(index, total) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round(((index + 1) / total) * 100)))
}

function animateScore(el) {
  el.classList.add('score-animation', 'text-green-600')
  setTimeout(() => {
    el.classList.remove('score-animation', 'text-green-600')
  }, 500)
}

function showPyro() {
  if (!pyro) return
  pyro.style.display = 'block'
  if (pyroTimeout) clearTimeout(pyroTimeout)
  pyroTimeout = setTimeout(() => {
    pyro.style.display = 'none'
  }, 1600)
}

function renderAnswerLog(answerLog) {
  if (!Array.isArray(answerLog) || !answerLog.length) {
    summaryEl.classList.add('hidden')
    summaryEl.innerHTML = ''
    return
  }

  summaryEl.classList.remove('hidden')
  summaryEl.innerHTML = `
    <div class="p-6 rounded-2xl border shadow-sm bg-white/80 border-slate-200">
      <div class="flex justify-between items-center">
        <h3 class="text-xl font-bold tracking-tight text-slate-900">Answer Summary</h3>
        <button id="clear-log" class="px-3 py-2 text-sm font-semibold bg-white rounded-xl border border-slate-200 hover:bg-slate-50">Clear</button>
      </div>
      <div class="grid grid-cols-1 gap-3 mt-4">
        ${answerLog
          .map((e) => {
            const a = e.teamA ? `${e.teamA.text} ${e.teamA.correct ? '(✓)' : '(✗)'}` : '—'
            const b = e.teamB ? `${e.teamB.text} ${e.teamB.correct ? '(✓)' : '(✗)'}` : '—'
            return `
              <div class="p-4 bg-white rounded-xl border border-slate-200">
                <div class="flex gap-3 justify-between items-center">
                  <div class="text-sm font-semibold text-slate-900">Q${e.index + 1} <span class="text-xs font-medium text-slate-500">${e.category || ''}</span></div>
                  <div class="text-xs text-slate-500">Correct: <span class="font-semibold text-slate-700">${e.correctText}</span></div>
                </div>
                <div class="mt-2 text-sm text-slate-800">${e.question}</div>
                <div class="grid grid-cols-1 gap-2 mt-3 md:grid-cols-2">
                  <div class="p-3 text-sm font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-800">A: ${a}</div>
                  <div class="p-3 text-sm font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-800">B: ${b}</div>
                </div>
              </div>
            `
          })
          .join('')}
      </div>
    </div>
  `

  document.getElementById('clear-log')?.addEventListener('click', () => {
    const code = roomEl.textContent.trim()
    if (code && code !== '----') localStorage.removeItem(`${LOG_KEY_PREFIX}${code}`)
    summaryEl.classList.add('hidden')
    summaryEl.innerHTML = ''
  })
}

const socket = createSocket()

socket.on('connect', () => {
  setError('')
  const saved = localStorage.getItem(HOST_ROOM_KEY)
  if (saved) socket.emit('host:join', { code: saved })
  else socket.emit('room:create')
})

socket.on('room:created', ({ code }) => {
  setError('')
  localStorage.setItem(HOST_ROOM_KEY, code)
  setRoom(code)
})

socket.on('error:message', ({ message }) => {
  setError(message || 'Error')
  if (String(message || '').toLowerCase().includes('room not found')) {
    localStorage.removeItem(HOST_ROOM_KEY)
    socket.emit('room:create')
  }
})

socket.on('host:state', (state) => {
  setError('')
  const code = state.code
  if (code) localStorage.setItem(HOST_ROOM_KEY, code)
  setRoom(code)

  teamAStatus.textContent = state.teams.A.connected ? 'Connected' : 'Not connected'
  teamBStatus.textContent = state.teams.B.connected ? 'Connected' : 'Not connected'
  teamASub.textContent = state.teams.A.submitted ? 'Submitted' : 'Not submitted'
  teamBSub.textContent = state.teams.B.submitted ? 'Submitted' : 'Not submitted'

  const nextA = Number(state.scores.A ?? 0)
  const nextB = Number(state.scores.B ?? 0)
  if (Number.isFinite(nextA) && nextA !== lastScores.A) {
    scoreAEl.textContent = String(nextA)
    if (nextA > lastScores.A) animateScore(scoreAEl)
  } else {
    scoreAEl.textContent = String(state.scores.A ?? 0)
  }
  if (Number.isFinite(nextB) && nextB !== lastScores.B) {
    scoreBEl.textContent = String(nextB)
    if (nextB > lastScores.B) animateScore(scoreBEl)
  } else {
    scoreBEl.textContent = String(state.scores.B ?? 0)
  }
  lastScores = { A: nextA, B: nextB }

  if (!state.question) {
    qProgress.textContent = state.phase === 'lobby' ? 'Lobby' : 'Waiting…'
    bar.style.width = '0%'
    questionEl.textContent = 'Waiting for game…'
    revealEl.classList.add('hidden')
    revealEl.innerHTML = ''
    return
  }

  qProgress.textContent = `Question ${state.index + 1} of ${state.total}`
  bar.style.width = `${pct(state.index, state.total)}%`
  questionEl.textContent = state.question.text

  const canReveal = state.phase === 'question' && state.teams.A.submitted && state.teams.B.submitted
  revealBtn.disabled = !canReveal
  revealBtn.classList.toggle('opacity-60', !canReveal)
  revealBtn.classList.toggle('cursor-not-allowed', !canReveal)

  const canNext = state.phase === 'reveal'
  nextBtn.disabled = !canNext
  nextBtn.classList.toggle('opacity-60', !canNext)
  nextBtn.classList.toggle('cursor-not-allowed', !canNext)
})

socket.on('host:reveal', (payload) => {
  const code = roomEl.textContent.trim()
  if (code && code !== '----' && Array.isArray(payload.answerLog)) {
    localStorage.setItem(`${LOG_KEY_PREFIX}${code}`, JSON.stringify(payload.answerLog))
    renderAnswerLog(payload.answerLog)
  }

  const aText = payload.teamA ? payload.teamA.text : '—'
  const bText = payload.teamB ? payload.teamB.text : '—'
  const aCorrect = payload.teamA?.correct === true
  const bCorrect = payload.teamB?.correct === true

  if (aCorrect || bCorrect) showPyro()

  revealEl.classList.remove('hidden')
  revealEl.innerHTML = `
    <div class="flex flex-wrap gap-3 justify-between items-center">
      <div class="text-sm font-semibold text-slate-700">
        Correct: <span class="font-extrabold text-slate-900">${payload.correctText}</span>
      </div>
      <div class="text-sm font-semibold text-slate-700">
        ${aCorrect && bCorrect ? 'Both teams are correct!' : aCorrect ? 'Team A is correct!' : bCorrect ? 'Team B is correct!' : 'No team is correct.'}
      </div>
    </div>
    <div class="grid grid-cols-1 gap-3 mt-4 md:grid-cols-2">
      <div class="p-4 rounded-xl border ${aCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
        <div class="flex justify-between items-center">
          <div class="text-sm font-extrabold text-slate-900">Team A</div>
          <div class="text-sm font-extrabold ${aCorrect ? 'text-green-700' : 'text-red-700'}">${aCorrect ? 'Correct' : 'Wrong'}</div>
        </div>
        <div class="mt-2 text-sm font-semibold text-slate-800">Answer: <span class="font-extrabold">${aText}</span></div>
      </div>
      <div class="p-4 rounded-xl border ${bCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
        <div class="flex justify-between items-center">
          <div class="text-sm font-extrabold text-slate-900">Team B</div>
          <div class="text-sm font-extrabold ${bCorrect ? 'text-green-700' : 'text-red-700'}">${bCorrect ? 'Correct' : 'Wrong'}</div>
        </div>
        <div class="mt-2 text-sm font-semibold text-slate-800">Answer: <span class="font-extrabold">${bText}</span></div>
      </div>
    </div>
  `
})

copyBtn?.addEventListener('click', async () => {
  const code = roomEl.textContent.trim()
  if (!code || code === '----') return
  await navigator.clipboard.writeText(code)
})

startBtn?.addEventListener('click', () => {
  const code = roomEl.textContent.trim()
  if (!code || code === '----') return
  socket.emit('host:start', { code })
})

revealBtn?.addEventListener('click', () => {
  const code = roomEl.textContent.trim()
  if (!code || code === '----') return
  socket.emit('host:reveal', { code })
})

nextBtn?.addEventListener('click', () => {
  const code = roomEl.textContent.trim()
  if (!code || code === '----') return
  socket.emit('host:next', { code })
  revealEl.classList.add('hidden')
  revealEl.innerHTML = ''
})

resetBtn?.addEventListener('click', () => {
  const code = roomEl.textContent.trim()
  if (!code || code === '----') return
  socket.emit('host:configure', { code, settings: { category: 'All', count: 'all', shuffle: true } })
  revealEl.classList.add('hidden')
  revealEl.innerHTML = ''
})

socket.connect()

loadServerInfo()

import './input.css'
import { createSocket } from './realtime.js'

const roomEl = document.getElementById('room-code')
const copyBtn = document.getElementById('copy-room')
const linksEl = document.getElementById('room-links')
const errEl = document.getElementById('host-error')

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

const LOG_KEY_PREFIX = 'quiz:host:answerLog:'

function setError(message) {
  errEl.textContent = message || ''
  errEl.classList.toggle('hidden', !message)
}

function setRoom(code) {
  roomEl.textContent = code || '----'
  if (!code) {
    linksEl.textContent = ''
    return
  }

  const teamA = new URL('/team.html', window.location.origin)
  teamA.searchParams.set('code', code)
  teamA.searchParams.set('team', 'A')

  const teamB = new URL('/team.html', window.location.origin)
  teamB.searchParams.set('code', code)
  teamB.searchParams.set('team', 'B')

  linksEl.innerHTML = `
    <div class="mt-1">Team A: <span class="font-semibold">${teamA.toString()}</span></div>
    <div class="mt-1">Team B: <span class="font-semibold">${teamB.toString()}</span></div>
  `
}

function pct(index, total) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round(((index + 1) / total) * 100)))
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
        <button id="clear-log" class="px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50">Clear</button>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-3">
        ${answerLog
          .map((e) => {
            const a = e.teamA ? `${e.teamA.text} ${e.teamA.correct ? '(✓)' : '(✗)'}` : '—'
            const b = e.teamB ? `${e.teamB.text} ${e.teamB.correct ? '(✓)' : '(✗)'}` : '—'
            return `
              <div class="p-4 rounded-xl border border-slate-200 bg-white">
                <div class="flex justify-between items-center gap-3">
                  <div class="text-sm font-semibold text-slate-900">Q${e.index + 1} <span class="text-xs font-medium text-slate-500">${e.category || ''}</span></div>
                  <div class="text-xs text-slate-500">Correct: <span class="font-semibold text-slate-700">${e.correctText}</span></div>
                </div>
                <div class="mt-2 text-sm text-slate-800">${e.question}</div>
                <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div class="p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">A: ${a}</div>
                  <div class="p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">B: ${b}</div>
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
  socket.emit('room:create')
})

socket.on('room:created', ({ code }) => {
  setRoom(code)
})

socket.on('error:message', ({ message }) => {
  setError(message || 'Error')
})

socket.on('host:state', (state) => {
  const code = state.code
  setRoom(code)

  teamAStatus.textContent = state.teams.A.connected ? 'Connected' : 'Not connected'
  teamBStatus.textContent = state.teams.B.connected ? 'Connected' : 'Not connected'
  teamASub.textContent = state.teams.A.submitted ? 'Submitted' : 'Not submitted'
  teamBSub.textContent = state.teams.B.submitted ? 'Submitted' : 'Not submitted'

  scoreAEl.textContent = String(state.scores.A ?? 0)
  scoreBEl.textContent = String(state.scores.B ?? 0)

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

  revealEl.classList.remove('hidden')
  revealEl.innerHTML = `
    <div class="text-sm font-semibold text-slate-700">Correct: <span class="font-extrabold text-slate-900">${payload.correctText}</span></div>
    <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
      <div class="p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">A: ${payload.teamA ? payload.teamA.text : '—'}</div>
      <div class="p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">B: ${payload.teamB ? payload.teamB.text : '—'}</div>
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

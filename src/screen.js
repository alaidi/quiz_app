import './input.css'
import { createSocket } from './realtime.js'

const roomEl = document.getElementById('room')
const scoreAEl = document.getElementById('score-a')
const scoreBEl = document.getElementById('score-b')
const barEl = document.getElementById('bar')
const progressEl = document.getElementById('progress')
const questionEl = document.getElementById('question')
const revealEl = document.getElementById('reveal')
const pyro = document.getElementById('pyro')

let lastScores = { A: 0, B: 0 }
let pyroTimeout = null

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

function getRoomCode() {
  const url = new URL(window.location.href)
  const q = String(url.searchParams.get('code') || '').trim().toUpperCase()
  if (q) return q
  const stored = localStorage.getItem('quiz:host:roomCode')
  return stored ? String(stored).trim().toUpperCase() : ''
}

const socket = createSocket()

socket.on('connect', () => {
  const code = getRoomCode()
  if (code) socket.emit('screen:join', { code })
})

socket.on('host:state', (state) => {
  if (!state) return
  roomEl.textContent = state.code || '----'

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
    barEl.style.width = '0%'
    progressEl.textContent = state.phase === 'lobby' ? 'Lobby' : 'Waiting…'
    questionEl.textContent = 'Waiting for host…'
    revealEl.classList.add('hidden')
    revealEl.innerHTML = ''
    return
  }

  barEl.style.width = `${pct(state.index, state.total)}%`
  progressEl.textContent = `Question ${state.index + 1} of ${state.total}`
  questionEl.textContent = state.question.text

  if (state.phase === 'question') {
    revealEl.classList.add('hidden')
    revealEl.innerHTML = ''
  }
})

socket.on('host:reveal', (payload) => {
  if (!payload) return
  const aText = payload.teamA ? payload.teamA.text : '—'
  const bText = payload.teamB ? payload.teamB.text : '—'
  const aCorrect = payload.teamA?.correct === true
  const bCorrect = payload.teamB?.correct === true

  if (aCorrect || bCorrect) showPyro()

  revealEl.classList.remove('hidden')
  revealEl.innerHTML = `
    <div class="flex flex-wrap gap-3 justify-between items-center">
      <div class="text-base font-semibold text-slate-700">
        Correct: <span class="font-extrabold text-slate-900">${payload.correctText}</span>
      </div>
      <div class="text-base font-extrabold text-slate-900">
        ${aCorrect && bCorrect ? 'Both teams are correct!' : aCorrect ? 'Team A is correct!' : bCorrect ? 'Team B is correct!' : 'No team is correct.'}
      </div>
    </div>
    <div class="grid grid-cols-1 gap-4 mt-5 md:grid-cols-2">
      <div class="p-5 rounded-2xl border ${aCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
        <div class="flex justify-between items-center">
          <div class="text-lg font-extrabold text-slate-900">Team A</div>
          <div class="text-lg font-extrabold ${aCorrect ? 'text-green-700' : 'text-red-700'}">${aCorrect ? 'Correct' : 'Wrong'}</div>
        </div>
        <div class="mt-2 text-base font-semibold text-slate-800">Answer: <span class="font-extrabold">${aText}</span></div>
      </div>
      <div class="p-5 rounded-2xl border ${bCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
        <div class="flex justify-between items-center">
          <div class="text-lg font-extrabold text-slate-900">Team B</div>
          <div class="text-lg font-extrabold ${bCorrect ? 'text-green-700' : 'text-red-700'}">${bCorrect ? 'Correct' : 'Wrong'}</div>
        </div>
        <div class="mt-2 text-base font-semibold text-slate-800">Answer: <span class="font-extrabold">${bText}</span></div>
      </div>
    </div>
  `
})

socket.connect()


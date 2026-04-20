import './input.css'
import { createSocket, getDeviceId } from './realtime.js'

const titleEl = document.getElementById('title')
const statusEl = document.getElementById('status')
const errorEl = document.getElementById('error')

const progressEl = document.getElementById('progress')
const scoreEl = document.getElementById('score')
const barEl = document.getElementById('bar')
const questionEl = document.getElementById('question')
const answersEl = document.getElementById('answers')
const submitBtn = document.getElementById('submit-answer')
const submittedEl = document.getElementById('submitted')
const resultEl = document.getElementById('result')

function setError(message) {
  errorEl.textContent = message || ''
  errorEl.classList.toggle('hidden', !message)
}

function pct(index, total) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round(((index + 1) / total) * 100)))
}

function parseParams() {
  const url = new URL(window.location.href)
  const code = String(url.searchParams.get('code') || '').trim().toUpperCase()
  const team = url.searchParams.get('team') === 'B' ? 'B' : 'A'
  return { code, team }
}

const { code, team } = parseParams()
const deviceId = getDeviceId()
const storageKey = `quiz:room:${code}:team:${team}:log:v1`

titleEl.textContent = `Team ${team}`

function loadLog() {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLog(log) {
  localStorage.setItem(storageKey, JSON.stringify(log))
}

let log = loadLog()
let lastQuestionIndex = null
let locked = false
let selectedIndex = null

function renderAnswers(question, disabled) {
  answersEl.innerHTML = ''
  if (!question || !Array.isArray(question.answers)) return
  question.answers.forEach((a, idx) => {
    const btn = document.createElement('button')
    btn.className = 'btn'
    btn.disabled = !!disabled
    btn.innerHTML = `
      <div class="flex gap-3 items-start">
        <span class="flex justify-center items-center mt-0.5 w-8 h-8 text-sm font-semibold bg-white rounded-lg border border-slate-200">${String.fromCharCode(
          65 + idx,
        )}</span>
        <span class="flex-1 text-base font-medium text-slate-800 md:text-lg">${a.text}</span>
      </div>
    `
    btn.addEventListener('click', () => {
      if (locked || disabled) return
      setError('')
      selectedIndex = idx
      Array.from(answersEl.children).forEach((child, childIdx) => {
        child.classList.toggle(team === 'A' ? 'team-a-selected' : 'team-b-selected', childIdx === idx)
      })
      if (submitBtn) submitBtn.disabled = false
    })
    answersEl.appendChild(btn)
  })
}

const socket = createSocket()

submitBtn?.addEventListener('click', () => {
  if (locked) return
  if (selectedIndex === null) return
  locked = true
  submitBtn.disabled = true
  socket.emit('team:answer', { code, team, deviceId, index: selectedIndex })
})

socket.on('connect', () => {
  statusEl.textContent = 'Connected. Joining room…'
  setError('')
  socket.emit('team:join', { code, team, deviceId })
})

socket.on('team:join:accepted', () => {
  statusEl.textContent = 'Joined. Waiting for host…'
})

socket.on('team:join:denied', ({ message }) => {
  statusEl.textContent = 'Cannot join'
  setError(message || 'Cannot join')
})

socket.on('team:state', (state) => {
  if (!state || state.code !== code || state.team !== team) return

  const myScore = team === 'A' ? state.scores.A : state.scores.B
  scoreEl.textContent = String(myScore ?? 0)

  if (!state.question) {
    progressEl.textContent = state.phase === 'lobby' ? 'Waiting in lobby…' : 'Waiting…'
    barEl.style.width = '0%'
    questionEl.textContent = 'Waiting for host…'
    answersEl.innerHTML = ''
    if (submitBtn) submitBtn.disabled = true
    submittedEl.classList.add('hidden')
    resultEl.classList.add('hidden')
    resultEl.innerHTML = ''
    locked = false
    selectedIndex = null
    return
  }

  progressEl.textContent = `Question ${state.index + 1} of ${state.total}`
  barEl.style.width = `${pct(state.index, state.total)}%`
  questionEl.textContent = state.question.text

  if (lastQuestionIndex !== state.index) {
    lastQuestionIndex = state.index
    resultEl.classList.add('hidden')
    resultEl.innerHTML = ''
    locked = false
    selectedIndex = null
    if (submitBtn) submitBtn.disabled = true
  }

  submittedEl.classList.toggle('hidden', !state.submitted)
  const disableChoices = state.submitted || state.phase !== 'question'
  renderAnswers(state.question, disableChoices)
  if (submitBtn) submitBtn.disabled = disableChoices || selectedIndex === null
})

socket.on('team:answer:accepted', () => {
  submittedEl.classList.remove('hidden')
})

socket.on('team:answer:denied', ({ message }) => {
  locked = false
  setError(message || 'Answer rejected')
  if (submitBtn) submitBtn.disabled = selectedIndex === null
})

socket.on('team:reveal', (payload) => {
  if (!payload) return
  const entry = {
    index: payload.index,
    correctText: payload.correctText,
    mine: payload.mine,
    at: Date.now(),
  }
  log.push(entry)
  saveLog(log)

  resultEl.classList.remove('hidden')
  const mine = payload.mine?.text ?? '—'
  const ok = payload.mine?.correct === true
  resultEl.innerHTML = `
    <div class="text-sm font-semibold text-slate-700">Correct: <span class="font-extrabold text-slate-900">${payload.correctText}</span></div>
    <div class="mt-2 text-sm font-semibold ${ok ? 'text-green-600' : 'text-red-600'}">Your answer: ${mine} ${ok ? '(Correct)' : '(Wrong)'}</div>
  `
})

if (!code) {
  statusEl.textContent = 'Missing room code'
  setError('Open this page from the Join screen (room code is required).')
} else {
  socket.connect()
}

const themeColors = {
  default: {
    primary: '#60a5fa',
    secondary: '#67e8f9',
    accent: '#3b82f6',
    backgroundStart: '#0f172a',
    backgroundMiddle: '#164e63',
    backgroundEnd: '#0f172a',
  },
  ocean: {
    primary: '#22d3ee',
    secondary: '#5eead4',
    accent: '#06b6d4',
    backgroundStart: '#0f172a',
    backgroundMiddle: '#134e4a',
    backgroundEnd: '#0f172a',
  },
  forest: {
    primary: '#4ade80',
    secondary: '#86efac',
    accent: '#22c55e',
    backgroundStart: '#0f172a',
    backgroundMiddle: '#14532d',
    backgroundEnd: '#0f172a',
  },
  sunset: {
    primary: '#fb923c',
    secondary: '#fdba74',
    accent: '#f97316',
    backgroundStart: '#0f172a',
    backgroundMiddle: '#7c2d12',
    backgroundEnd: '#0f172a',
  },
  purple: {
    primary: '#c084fc',
    secondary: '#d8b4fe',
    accent: '#a855f7',
    backgroundStart: '#0f172a',
    backgroundMiddle: '#581c87',
    backgroundEnd: '#0f172a',
  },
  neon: {
    primary: '#a3e635',
    secondary: '#bef264',
    accent: '#84cc16',
    backgroundStart: '#0f172a',
    backgroundMiddle: '#365314',
    backgroundEnd: '#0f172a',
  },
  ruby: {
    primary: '#f43f5e',
    secondary: '#fb7185',
    accent: '#e11d48',
    backgroundStart: '#0f172a',
    backgroundMiddle: '#881337',
    backgroundEnd: '#0f172a',
  },
  midnight: {
    primary: '#818cf8',
    secondary: '#a5b4fc',
    accent: '#6366f1',
    backgroundStart: '#0f172a',
    backgroundMiddle: '#312e81',
    backgroundEnd: '#0f172a',
  },
}

let questions = []
let currentTeam = 'A'
let teamATheme = localStorage.getItem('teamATheme') || 'default'
let teamBTheme = localStorage.getItem('teamBTheme') || 'default'
let currentQuestionIndex = 0
let teamAScore = 0
let teamBScore = 0
let teamAAnswered = false
let teamBAnswered = false
let teamACorrect = false
let teamBCorrect = false
let bothTeamsAnswered = false
let teamASelectedAnswer = ''

function applyTheme(theme) {
  const colors = themeColors[theme]
  if (!colors) return

  document.documentElement.style.setProperty('--primary', colors.primary)
  document.documentElement.style.setProperty('--secondary', colors.secondary)
  document.documentElement.style.setProperty('--accent', colors.accent)
  document.documentElement.style.setProperty('--background-start', colors.backgroundStart)
  document.documentElement.style.setProperty('--background-middle', colors.backgroundMiddle)
  document.documentElement.style.setProperty('--background-end', colors.backgroundEnd)
}

function animateScore(element, newScore) {
  const currentScore = parseInt(element.textContent)
  element.classList.add('score-animation')

  let start = currentScore
  const duration = 1000
  const steps = 20
  const increment = (newScore - start) / steps
  const stepDuration = duration / steps

  element.style.color = '#4ade80'
  element.style.textShadow = '0 0 10px rgba(74, 222, 128, 0.5)'

  const counter = setInterval(() => {
    start += increment
    element.textContent = Math.round(start)

    if ((increment >= 0 && start >= newScore) || (increment < 0 && start <= newScore)) {
      clearInterval(counter)
      element.textContent = newScore

      setTimeout(() => {
        element.classList.remove('score-animation')
        element.style.color = ''
        element.style.textShadow = ''
      }, 500)
    }
  }, stepDuration)
}

async function fetchQuestions() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/questions.json`)
    if (!response.ok) throw new Error('Failed to load questions')
    return await response.json()
  } catch (error) {
    console.error('Error loading questions:', error)
    return [
      {
        question: 'What is the capital of France?',
        answers: [
          { text: 'London', correct: false },
          { text: 'Paris', correct: true },
          { text: 'Berlin', correct: false },
          { text: 'Madrid', correct: false },
        ],
        category: 'Geography',
      },
      {
        question: "Which programming language is known as the 'language of the web'?",
        answers: [
          { text: 'Python', correct: false },
          { text: 'Java', correct: false },
          { text: 'JavaScript', correct: true },
          { text: 'C++', correct: false },
        ],
        category: 'Technology',
      },
    ]
  }
}

function selectRandomQuestions(questionBank, count) {
  if (count >= questionBank.length) return [...questionBank]
  const allQuestions = [...questionBank]
  const selectedQuestions = []
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * allQuestions.length)
    selectedQuestions.push(allQuestions.splice(randomIndex, 1)[0])
  }
  return selectedQuestions
}

const ANSWER_LOG_KEY = 'quiz:answerLog:v1'

function clampQuestionCount(value, available) {
  if (value === 'all') return 'all'
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 'all'
  return Math.min(n, available)
}

function safeName(value, fallback) {
  const v = String(value ?? '').trim()
  return v.length ? v.slice(0, 24) : fallback
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function loadAnswerLog() {
  try {
    const raw = localStorage.getItem(ANSWER_LOG_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAnswerLog(log) {
  localStorage.setItem(ANSWER_LOG_KEY, JSON.stringify(log))
}

function getCorrectAnswerText(question) {
  const correct = (question?.answers || []).find((a) => a && a.correct)
  return correct?.text ?? ''
}

document.addEventListener('DOMContentLoaded', function () {
  const questionElement = document.getElementById('question')
  const answerButtons = document.getElementById('answer-buttons')
  const nextButton = document.getElementById('next-btn')
  const teamAScoreElement = document.getElementById('team-a-score')
  const teamBScoreElement = document.getElementById('team-b-score')
  const pyro = document.querySelector('.pyro')
  const winnerModal = document.getElementById('winner-modal')
  const winnerTeam = document.getElementById('winner-team')
  const winnerScore = document.getElementById('winner-score')
  const closeWinner = document.getElementById('close-winner')
  const endQuizBtn = document.getElementById('end-quiz-btn')

  const teamANameEl = document.getElementById('team-a-name')
  const teamBNameEl = document.getElementById('team-b-name')

  let teamAName = safeName(localStorage.getItem('teamAName'), 'Team A')
  let teamBName = safeName(localStorage.getItem('teamBName'), 'Team B')
  let selectedCategory = localStorage.getItem('selectedCategory') || 'All'
  let questionCountSetting = localStorage.getItem('questionCountSetting') || 'all'
  let answerLog = loadAnswerLog()

  function setEndQuizVisible(visible) {
    if (!endQuizBtn) return
    endQuizBtn.classList.toggle('hidden', !visible)
  }

  function syncTeamLabels() {
    if (teamANameEl) teamANameEl.textContent = teamAName
    if (teamBNameEl) teamBNameEl.textContent = teamBName
  }

  function showWinner() {
    const scoreA = parseInt(teamAScoreElement.textContent) || 0
    const scoreB = parseInt(teamBScoreElement.textContent) || 0

    let winningTeamLabel = "It's a Tie!"
    let winningScore = scoreA

    if (scoreA > scoreB) {
      winningTeamLabel = teamAName
      winningScore = scoreA
    } else if (scoreB > scoreA) {
      winningTeamLabel = teamBName
      winningScore = scoreB
    }

    if (winnerTeam) winnerTeam.textContent = winningTeamLabel
    if (winnerScore) winnerScore.textContent = `Score: ${winningScore}`

    if (pyro) pyro.style.display = 'block'
    if (winnerModal) winnerModal.style.display = 'flex'
  }

  endQuizBtn?.addEventListener('click', showWinner)

  if (closeWinner) {
    closeWinner.addEventListener('click', function () {
      if (winnerModal) winnerModal.style.display = 'none'
      if (pyro) pyro.style.display = 'none'
      showQuizSetup()
    })
  }

  const quizSetupElement = document.createElement('div')
  quizSetupElement.id = 'quiz-setup'
  quizSetupElement.className =
    'p-6 mb-8 rounded-2xl border shadow-sm backdrop-blur-sm bg-white/80 border-slate-200'

  let questionBank = []

  function getCategories(bank) {
    const categories = new Set()
    bank.forEach((q) => {
      if (q.category) categories.add(q.category)
    })
    return ['All', ...Array.from(categories)]
  }

  function filterQuestionsByCategory(bank, category) {
    if (category === 'All') return bank
    return bank.filter((q) => q.category === category)
  }

  async function loadQuestionBank() {
    try {
      questionBank = await fetchQuestions()
      if (!Array.isArray(questionBank) || questionBank.length === 0) throw new Error('No questions loaded')
      return true
    } catch (error) {
      console.error('Error loading question bank:', error)
      return false
    }
  }

  function resetState() {
    nextButton.classList.add('hidden')
    nextButton.classList.remove('animate-pulse', 'shadow-glow')
    nextButton.style.display = ''
    while (answerButtons.firstChild) answerButtons.removeChild(answerButtons.firstChild)
  }

  function renderProgress(questionNo, total) {
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((questionNo / total) * 100))) : 0
    return `
      <div class="mt-4">
        <div class="flex justify-between items-center text-sm text-slate-500">
          <span>Progress</span>
          <span class="font-medium text-slate-700">${questionNo} / ${total}</span>
        </div>
        <div class="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-blue-600 to-cyan-500" style="width:${pct}%"></div>
        </div>
      </div>
    `
  }

  function showQuizSetup() {
    resetState()
    setEndQuizVisible(false)
    syncTeamLabels()

    const categories = getCategories(questionBank)
    const filteredCount = filterQuestionsByCategory(questionBank, selectedCategory).length
    const normalizedCount = clampQuestionCount(questionCountSetting, filteredCount)
    questionCountSetting = String(normalizedCount)
    localStorage.setItem('questionCountSetting', questionCountSetting)

    const categoryMenuItems = categories
      .map(
        (category) => `
          <button data-category="${category}" class="flex items-center px-3 py-2 w-full text-left rounded-lg transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">
            <i class="mr-2 ri-bookmark-line"></i>${category}
          </button>
        `,
      )
      .join('')

    quizSetupElement.innerHTML = `
      <h2 class="mb-6 text-2xl font-bold tracking-tight text-center text-slate-900">Quiz Setup</h2>

      <div class="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
        <div>
          <label class="block mb-2 text-sm font-medium text-slate-700">Team A name</label>
          <input id="team-a-input" value="${teamAName}" class="px-4 py-3 w-full rounded-xl border shadow-sm bg-white/90 border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300" />
        </div>
        <div>
          <label class="block mb-2 text-sm font-medium text-slate-700">Team B name</label>
          <input id="team-b-input" value="${teamBName}" class="px-4 py-3 w-full rounded-xl border shadow-sm bg-white/90 border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300" />
        </div>
      </div>

      <div class="mb-6">
        <label class="block mb-2 text-sm font-medium text-slate-700">Category</label>
        <div class="relative">
          <button id="category-selector" class="flex items-center px-4 py-3 w-full rounded-xl border shadow-sm transition-colors bg-white/90 border-slate-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">
            <i class="mr-2 ri-book-line"></i>
            <span id="current-category">${selectedCategory}</span>
            <i class="ml-auto ri-arrow-down-s-line"></i>
          </button>
          <div id="category-menu" class="hidden absolute left-0 z-10 mt-2 w-full rounded-xl border shadow-xl backdrop-blur-xl bg-white/95 border-slate-200">
            <div class="p-2 space-y-1">${categoryMenuItems}</div>
          </div>
        </div>
        <p class="mt-2 text-sm text-slate-500">
          <span id="available-questions" class="font-semibold text-slate-700">${filteredCount}</span> questions available in this category
        </p>
      </div>

      <div class="mb-6">
        <label class="block mb-2 text-sm font-medium text-slate-700">Questions this game</label>
        <select id="question-count" class="px-4 py-3 w-full rounded-xl border shadow-sm bg-white/90 border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">
          <option value="5" ${questionCountSetting === '5' ? 'selected' : ''}>5</option>
          <option value="10" ${questionCountSetting === '10' ? 'selected' : ''}>10</option>
          <option value="15" ${questionCountSetting === '15' ? 'selected' : ''}>15</option>
          <option value="all" ${questionCountSetting === 'all' || questionCountSetting === String(filteredCount) ? 'selected' : ''}>All</option>
        </select>
        <p class="mt-2 text-sm text-slate-500">Each question is answered by both teams (A then B).</p>
      </div>

      <button id="start-quiz-btn" class="py-3.5 w-full font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl transition-all hover:from-blue-700 hover:to-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">
        <i class="mr-2 ri-play-fill"></i>Start Quiz
      </button>
    `

    questionElement.innerHTML = ''
    questionElement.appendChild(quizSetupElement)

    const teamAInput = document.getElementById('team-a-input')
    const teamBInput = document.getElementById('team-b-input')
    const questionCountSelect = document.getElementById('question-count')
    const categorySelector = document.getElementById('category-selector')
    const categoryMenu = document.getElementById('category-menu')

    teamAInput?.addEventListener('input', () => {
      teamAName = safeName(teamAInput.value, 'Team A')
      localStorage.setItem('teamAName', teamAName)
      syncTeamLabels()
    })

    teamBInput?.addEventListener('input', () => {
      teamBName = safeName(teamBInput.value, 'Team B')
      localStorage.setItem('teamBName', teamBName)
      syncTeamLabels()
    })

    questionCountSelect?.addEventListener('change', () => {
      questionCountSetting = questionCountSelect.value
      localStorage.setItem('questionCountSetting', questionCountSetting)
    })

    categorySelector?.addEventListener('click', () => {
      categoryMenu?.classList.toggle('hidden')
    })

    document.querySelectorAll('#category-menu button').forEach((button) => {
      button.addEventListener('click', () => {
        selectedCategory = button.dataset.category
        localStorage.setItem('selectedCategory', selectedCategory)
        document.getElementById('current-category').textContent = selectedCategory
        const filtered = filterQuestionsByCategory(questionBank, selectedCategory)
        document.getElementById('available-questions').textContent = filtered.length
        categoryMenu?.classList.add('hidden')
      })
    })

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#category-selector') && !e.target.closest('#category-menu')) {
        categoryMenu?.classList.add('hidden')
      }
    })

    document.getElementById('start-quiz-btn')?.addEventListener('click', startQuiz)
  }

  async function startQuiz() {
    try {
      if (questionBank.length === 0) {
        const loaded = await loadQuestionBank()
        if (!loaded) throw new Error('Failed to load question bank')
      }

      const filtered = filterQuestionsByCategory(questionBank, selectedCategory)
      const normalizedCount = clampQuestionCount(questionCountSetting, filtered.length)
      const count = normalizedCount === 'all' ? filtered.length : Number(normalizedCount)
      questions = selectRandomQuestions(filtered, count)

      currentQuestionIndex = 0
      teamAScore = 0
      teamBScore = 0
      currentTeam = 'A'
      teamAAnswered = false
      teamBAnswered = false
      teamACorrect = false
      teamBCorrect = false
      bothTeamsAnswered = false
      teamASelectedAnswer = ''
      answerLog = []
      saveAnswerLog(answerLog)

      nextButton.classList.add('hidden')
      nextButton.style.display = ''
      teamAScoreElement.textContent = '0'
      teamBScoreElement.textContent = '0'
      setEndQuizVisible(true)
      syncTeamLabels()

      if (quizSetupElement.parentNode) quizSetupElement.parentNode.removeChild(quizSetupElement)
      showQuestion()
    } catch (error) {
      console.error('Error starting quiz:', error)
      questionElement.innerHTML = `
        <div class="text-center">
          <h2 class="mb-8 text-2xl font-bold text-red-500">Error Loading Questions</h2>
          <p class="mb-4 text-slate-700">We couldn't load the quiz questions. Please try again later.</p>
          <button id="retry-btn" class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">Retry</button>
        </div>
      `
      document.getElementById('retry-btn')?.addEventListener('click', startQuiz)
    }
  }

  function showQuestion() {
    resetState()
    setEndQuizVisible(true)

    if (!questions || !questions.length || currentQuestionIndex >= questions.length) return
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion || !currentQuestion.question || !Array.isArray(currentQuestion.answers)) return

    const questionNo = currentQuestionIndex + 1
    const total = questions.length

    if (teamAAnswered && teamBAnswered) return

    questionElement.style.opacity = '0'
    setTimeout(() => {
      if (!teamAAnswered) {
        questionElement.innerHTML = `
          <div class="flex flex-wrap gap-3 justify-between items-center">
            <span class="text-sm font-medium text-slate-500">Question ${questionNo} of ${total}</span>
            <span class="team-turn-badge-a"><i class="ri-team-fill"></i><span>${teamAName}'s turn</span></span>
          </div>
          ${renderProgress(questionNo, total)}
          <div class="mt-5 text-xl font-semibold leading-snug text-slate-900 md:text-2xl">${currentQuestion.question}</div>
        `
        currentTeam = 'A'
        applyTheme(teamATheme)
      } else if (!teamBAnswered) {
        questionElement.innerHTML = `
          <div class="flex flex-wrap gap-3 justify-between items-center">
            <span class="text-sm font-medium text-slate-500">Question ${questionNo} of ${total}</span>
            <span class="team-turn-badge-b"><i class="ri-team-fill"></i><span>${teamBName}'s turn</span></span>
          </div>
          ${renderProgress(questionNo, total)}
          <div class="mt-5 text-xl font-semibold leading-snug text-slate-900 md:text-2xl">${currentQuestion.question}</div>
        `
        currentTeam = 'B'
        applyTheme(teamBTheme)
      }

      setTimeout(() => {
        questionElement.style.opacity = '1'
      }, 100)
    }, 250)

    currentQuestion.answers.forEach((answer, index) => {
      const button = document.createElement('button')
      button.innerHTML = `
        <div class="flex gap-3 items-start">
          <span class="flex justify-center items-center mt-0.5 w-8 h-8 text-sm font-semibold bg-white rounded-lg border border-slate-200">${String.fromCharCode(
            65 + index,
          )}</span>
          <span class="flex-1 text-base font-medium text-slate-800 md:text-lg">${answer.text}</span>
        </div>
      `
      button.classList.add('btn')
      button.style.animation = `slideIn 0.3s ease-out ${index * 0.1}s both`
      if (answer.correct) button.dataset.correct = String(answer.correct)
      button.dataset.answerText = answer.text
      if (teamAAnswered && answer.text === teamASelectedAnswer) button.classList.add('team-a-selected')
      button.addEventListener('click', selectAnswer)
      answerButtons.appendChild(button)
    })
  }

  function selectAnswer(e) {
    const selectedBtn = e.target.closest('.btn')
    if (!selectedBtn) return

    const isCorrect = selectedBtn.dataset.correct === 'true'
    const answerText = selectedBtn.dataset.answerText

    if ((currentTeam === 'A' && teamAAnswered) || (currentTeam === 'B' && teamBAnswered)) return

    const q = questions[currentQuestionIndex]
    const correctText = getCorrectAnswerText(q)
    if (!answerLog[currentQuestionIndex]) {
      answerLog[currentQuestionIndex] = {
        index: currentQuestionIndex,
        question: q?.question ?? '',
        correctAnswer: correctText,
        teamA: null,
        teamB: null,
      }
    }

    if (currentTeam === 'A') {
      teamAAnswered = true
      teamACorrect = isCorrect
      teamASelectedAnswer = answerText
      selectedBtn.classList.add('team-a-selected')
      answerLog[currentQuestionIndex].teamA = { text: answerText, correct: isCorrect }
      saveAnswerLog(answerLog)

      Array.from(answerButtons.children).forEach((b) => {
        b.disabled = true
      })

      setTimeout(() => {
        showQuestion()
      }, 450)
    } else {
      teamBAnswered = true
      teamBCorrect = isCorrect
      selectedBtn.classList.add('team-b-selected')
      answerLog[currentQuestionIndex].teamB = { text: answerText, correct: isCorrect }
      saveAnswerLog(answerLog)

      if (teamACorrect) {
        teamAScore++
        animateScore(teamAScoreElement, teamAScore)
      }
      if (teamBCorrect) {
        teamBScore++
        animateScore(teamBScoreElement, teamBScore)
      }

      Array.from(answerButtons.children).forEach((b) => {
        if (b.dataset.correct === 'true') b.classList.add('correct')
        if (b === selectedBtn && !isCorrect) b.classList.add('incorrect')
        b.disabled = true
      })

      setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          handleNextButton()
        } else {
          showScore()
        }
      }, 1700)
    }

    bothTeamsAnswered = teamAAnswered && teamBAnswered
  }

  function renderAnswerLog() {
    const rows = (answerLog || [])
      .filter(Boolean)
      .map((entry, idx) => {
        const qText = escapeHtml(entry.question)
        const correct = escapeHtml(entry.correctAnswer)
        const aText = escapeHtml(entry.teamA?.text ?? '—')
        const bText = escapeHtml(entry.teamB?.text ?? '—')
        const aOk = entry.teamA?.correct === true
        const bOk = entry.teamB?.correct === true
        return `
          <div class="p-4 rounded-xl border border-slate-200 bg-white/80">
            <div class="flex justify-between items-start gap-4">
              <div class="text-sm font-semibold text-slate-900">Q${idx + 1}</div>
              <div class="text-xs font-medium text-slate-500">${escapeHtml(selectedCategory)}</div>
            </div>
            <div class="mt-2 text-sm font-medium text-slate-800">${qText}</div>
            <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div class="flex items-start justify-between gap-3 p-3 rounded-lg border ${aOk ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}">
                <div>
                  <div class="text-xs font-semibold text-slate-500">${escapeHtml(teamAName)}</div>
                  <div class="mt-1 text-sm font-medium text-slate-900">${aText}</div>
                </div>
                <div class="text-xs font-semibold ${aOk ? 'text-green-600' : 'text-slate-500'}">${aOk ? 'Correct' : 'Wrong'}</div>
              </div>
              <div class="flex items-start justify-between gap-3 p-3 rounded-lg border ${bOk ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}">
                <div>
                  <div class="text-xs font-semibold text-slate-500">${escapeHtml(teamBName)}</div>
                  <div class="mt-1 text-sm font-medium text-slate-900">${bText}</div>
                </div>
                <div class="text-xs font-semibold ${bOk ? 'text-green-600' : 'text-slate-500'}">${bOk ? 'Correct' : 'Wrong'}</div>
              </div>
            </div>
            <div class="mt-3 text-xs text-slate-500">Correct answer: <span class="font-semibold text-slate-700">${correct}</span></div>
          </div>
        `
      })
      .join('')

    if (!rows.length) return ''

    return `
      <div class="mt-10 text-left">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-xl font-bold tracking-tight text-slate-900">Answer Summary</h3>
          <button id="clear-history" class="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">Clear</button>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-4">
          ${rows}
        </div>
      </div>
    `
  }

  function showScore() {
    resetState()
    setEndQuizVisible(false)

    let winnerLabel = "It's a tie"
    if (teamAScore > teamBScore) winnerLabel = teamAName
    else if (teamBScore > teamAScore) winnerLabel = teamBName

    questionElement.innerHTML = `
      <div class="text-center">
        <h2 class="mb-8 text-4xl font-extrabold tracking-tight animate-bounce text-slate-900">Game Over!</h2>
        <div class="grid grid-cols-2 gap-8 mb-8">
          <div class="p-8 rounded-2xl border shadow-sm transition-transform transform bg-white/80 border-slate-200 hover:scale-105">
            <h3 class="mb-2 text-xl font-semibold text-slate-900">${teamAName}</h3>
            <span class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">${teamAScore}</span>
          </div>
          <div class="p-8 rounded-2xl border shadow-sm transition-transform transform bg-white/80 border-slate-200 hover:scale-105">
            <h3 class="mb-2 text-xl font-semibold text-slate-900">${teamBName}</h3>
            <span class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">${teamBScore}</span>
          </div>
        </div>
        <div class="mb-6 text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 md:text-4xl">
          ${winnerLabel === "It's a tie" ? "It's a tie!" : `${winnerLabel} wins!`}
        </div>
        <div class="text-base text-slate-600 md:text-lg">
          ${getWinnerMessage(winnerLabel === "It's a tie" ? "It's a tie" : winnerLabel, teamAScore, teamBScore)}
        </div>
        ${renderAnswerLog()}
      </div>
    `

    document.getElementById('clear-history')?.addEventListener('click', () => {
      answerLog = []
      saveAnswerLog(answerLog)
      showScore()
    })

    nextButton.innerHTML = '<i class="mr-2 ri-restart-line"></i>Play Again'
    nextButton.classList.remove('hidden')
    nextButton.classList.add('animate-pulse', 'shadow-glow')
    showWinner()
  }

  function handleNextButton() {
    currentQuestionIndex++
    teamAAnswered = false
    teamBAnswered = false
    bothTeamsAnswered = false
    if (currentQuestionIndex < questions.length) showQuestion()
    else showScore()
  }

  function initializeTeamThemeSelectors() {
    const teamAButton = document.getElementById('team-a-theme-btn')
    const teamBButton = document.getElementById('team-b-theme-btn')
    const teamAMenu = document.getElementById('team-a-theme-menu')
    const teamBMenu = document.getElementById('team-b-theme-menu')
    const teamAThemeIndicator = document.querySelector('.team-a-theme-indicator')
    const teamBThemeIndicator = document.querySelector('.team-b-theme-indicator')

    if (teamAThemeIndicator) teamAThemeIndicator.textContent = teamATheme
    if (teamBThemeIndicator) teamBThemeIndicator.textContent = teamBTheme

    document.querySelectorAll('#team-a-theme-menu .theme-option').forEach((option) => {
      option.addEventListener('click', function () {
        const theme = this.dataset.theme
        teamATheme = theme
        localStorage.setItem('teamATheme', theme)
        if (teamAThemeIndicator) teamAThemeIndicator.textContent = theme
        if (currentTeam === 'A') applyTheme(theme)
        teamAMenu.classList.add('hidden')
      })
    })

    document.querySelectorAll('#team-b-theme-menu .theme-option').forEach((option) => {
      option.addEventListener('click', function () {
        const theme = this.dataset.theme
        teamBTheme = theme
        localStorage.setItem('teamBTheme', theme)
        if (teamBThemeIndicator) teamBThemeIndicator.textContent = theme
        if (currentTeam === 'B') applyTheme(theme)
        teamBMenu.classList.add('hidden')
      })
    })

    teamAButton?.addEventListener('click', () => {
      teamAMenu.classList.toggle('hidden')
      teamBMenu?.classList.add('hidden')
    })

    teamBButton?.addEventListener('click', () => {
      teamBMenu.classList.toggle('hidden')
      teamAMenu?.classList.add('hidden')
    })

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#team-a-theme-btn') && !e.target.closest('#team-a-theme-menu')) teamAMenu?.classList.add('hidden')
      if (!e.target.closest('#team-b-theme-btn') && !e.target.closest('#team-b-theme-menu')) teamBMenu?.classList.add('hidden')
    })
  }

  function initializeGlobalThemeMenu() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn')
    const themeMenu = document.getElementById('theme-menu')
    themeToggleBtn?.addEventListener('click', () => {
      themeMenu?.classList.toggle('hidden')
    })
    document.querySelectorAll('#theme-menu .theme-option').forEach((option) => {
      option.addEventListener('click', function () {
        const theme = this.dataset.theme
        applyTheme(theme)
        themeMenu?.classList.add('hidden')
      })
    })
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#theme-toggle-btn') && !e.target.closest('#theme-menu')) themeMenu?.classList.add('hidden')
    })
  }

  nextButton.addEventListener('click', showQuizSetup)

  initializeTeamThemeSelectors()
  initializeGlobalThemeMenu()
  applyTheme(currentTeam === 'A' ? teamATheme : teamBTheme)
  syncTeamLabels()

  loadQuestionBank().then((success) => {
    if (success) {
      showQuizSetup()
    } else {
      questionElement.innerHTML = `
        <div class="text-center">
          <h2 class="mb-8 text-2xl font-bold text-red-500">Error Loading Questions</h2>
          <p class="mb-4 text-slate-700">We couldn't load the quiz questions. Please try again later.</p>
          <button id="retry-btn" class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">Retry</button>
        </div>
      `
      document.getElementById('retry-btn')?.addEventListener('click', () => {
        loadQuestionBank().then((ok) => {
          if (ok) showQuizSetup()
        })
      })
    }
  })

  setEndQuizVisible(false)
})

window.applyTheme = applyTheme

function getWinnerMessage(winner, aScore, bScore) {
  const scoreDifference = Math.abs(aScore - bScore)
  if (winner === "It's a tie") return 'Both teams performed equally well! Great game!'
  if (scoreDifference >= 4) return `${winner} dominated the game with an impressive victory!`
  if (scoreDifference >= 2) return `${winner} secured a solid win!`
  return `${winner} won in a close match!`
}

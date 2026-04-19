const http = require('http')
const path = require('path')
const fs = require('fs')
const express = require('express')
const { Server } = require('socket.io')

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

function readQuestions() {
  const filePath = path.resolve(process.cwd(), 'public', 'data', 'questions.json')
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getCorrectIndex(question) {
  const idx = (question?.answers || []).findIndex((a) => a && a.correct)
  return idx >= 0 ? idx : 0
}

function sanitizeTeam(team) {
  return team === 'A' || team === 'B' ? team : null
}

function makeRoomState(code) {
  return {
    code,
    createdAt: Date.now(),
    phase: 'lobby',
    questions: [],
    index: 0,
    submissions: { A: null, B: null },
    scores: { A: 0, B: 0 },
    teams: {
      A: { deviceId: null, socketId: null, connected: false },
      B: { deviceId: null, socketId: null, connected: false },
    },
    host: { socketId: null, connected: false },
    answerLog: [],
    settings: { category: 'All', count: 'all', shuffle: true },
  }
}

async function start() {
  const isProd = process.env.NODE_ENV === 'production'
  const port = Number(process.env.PORT || 5173)

  const app = express()
  const server = http.createServer(app)
  const io = new Server(server, { cors: { origin: true, credentials: true } })

  const rooms = new Map()

  function getRoom(code) {
    return rooms.get(code) || null
  }

  function emitRoomState(room) {
    const hostPayload = {
      code: room.code,
      phase: room.phase,
      index: room.index,
      total: room.questions.length,
      scores: room.scores,
      teams: {
        A: { connected: room.teams.A.connected, submitted: !!room.submissions.A },
        B: { connected: room.teams.B.connected, submitted: !!room.submissions.B },
      },
      question: room.questions[room.index]
        ? {
            text: room.questions[room.index].question,
            answers: room.questions[room.index].answers.map((a) => ({ text: a.text })),
            category: room.questions[room.index].category || '',
          }
        : null,
    }

    io.to(`host:${room.code}`).emit('host:state', hostPayload)

    ;(['A', 'B']).forEach((team) => {
      const slot = room.teams[team]
      const question = room.questions[room.index]
      const payload = {
        code: room.code,
        phase: room.phase,
        team,
        index: room.index,
        total: room.questions.length,
        scores: room.scores,
        connected: slot.connected,
        submitted: !!room.submissions[team],
        question: question
          ? {
              text: question.question,
              answers: question.answers.map((a) => ({ text: a.text })),
              category: question.category || '',
            }
          : null,
      }
      io.to(`team:${room.code}:${team}`).emit('team:state', payload)
    })
  }

  function selectQuestions(settings) {
    const bank = readQuestions()
    const category = settings.category || 'All'
    const countSetting = settings.count || 'all'
    const shouldShuffle = settings.shuffle !== false

    const filtered = category === 'All' ? bank : bank.filter((q) => q.category === category)
    const list = shouldShuffle ? shuffle(filtered) : [...filtered]

    if (countSetting === 'all') return list
    const n = Math.max(1, Math.min(Number(countSetting) || list.length, list.length))
    return list.slice(0, n)
  }

  function reveal(room) {
    if (room.phase !== 'question') return
    const q = room.questions[room.index]
    if (!q) return

    const correctIndex = getCorrectIndex(q)
    const correctText = q.answers?.[correctIndex]?.text || ''

    const a = room.submissions.A
    const b = room.submissions.B

    const aCorrect = a?.index === correctIndex
    const bCorrect = b?.index === correctIndex

    if (a && aCorrect) room.scores.A += 1
    if (b && bCorrect) room.scores.B += 1

    room.answerLog.push({
      index: room.index,
      question: q.question,
      category: q.category || '',
      correctIndex,
      correctText,
      teamA: a ? { index: a.index, text: q.answers?.[a.index]?.text || '', correct: aCorrect } : null,
      teamB: b ? { index: b.index, text: q.answers?.[b.index]?.text || '', correct: bCorrect } : null,
    })

    room.phase = room.index >= room.questions.length - 1 ? 'finished' : 'reveal'

    io.to(`host:${room.code}`).emit('host:reveal', {
      index: room.index,
      correctIndex,
      correctText,
      scores: room.scores,
      teamA: room.answerLog.at(-1)?.teamA || null,
      teamB: room.answerLog.at(-1)?.teamB || null,
      finished: room.phase === 'finished',
      answerLog: room.answerLog,
    })

    ;(['A', 'B']).forEach((team) => {
      const entry = room.answerLog.at(-1)
      const mine = team === 'A' ? entry?.teamA : entry?.teamB
      io.to(`team:${room.code}:${team}`).emit('team:reveal', {
        index: room.index,
        correctIndex,
        correctText,
        scores: room.scores,
        mine: mine || null,
        finished: room.phase === 'finished',
      })
    })

    emitRoomState(room)
  }

  function next(room) {
    if (room.phase !== 'reveal') return
    room.index += 1
    room.phase = 'question'
    room.submissions = { A: null, B: null }
    emitRoomState(room)
  }

  io.on('connection', (socket) => {
    socket.on('room:create', () => {
      let code = generateRoomCode()
      while (rooms.has(code)) code = generateRoomCode()
      const room = makeRoomState(code)
      room.host.socketId = socket.id
      room.host.connected = true
      rooms.set(code, room)
      socket.join(`room:${code}`)
      socket.join(`host:${code}`)
      socket.emit('room:created', { code })
      emitRoomState(room)
    })

    socket.on('host:join', ({ code }) => {
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return socket.emit('error:message', { message: 'Room not found' })
      room.host.socketId = socket.id
      room.host.connected = true
      socket.join(`room:${room.code}`)
      socket.join(`host:${room.code}`)
      emitRoomState(room)
    })

    socket.on('team:join', ({ code, team, deviceId }) => {
      const room = getRoom(String(code || '').toUpperCase())
      const t = sanitizeTeam(team)
      const d = String(deviceId || '').trim()
      if (!room) return socket.emit('team:join:denied', { message: 'Room not found' })
      if (!t) return socket.emit('team:join:denied', { message: 'Invalid team' })
      if (!d) return socket.emit('team:join:denied', { message: 'Missing device id' })

      const slot = room.teams[t]
      if (slot.deviceId && slot.deviceId !== d) {
        return socket.emit('team:join:denied', { message: 'This team is already connected on another device' })
      }

      slot.deviceId = d
      slot.socketId = socket.id
      slot.connected = true

      socket.join(`room:${room.code}`)
      socket.join(`team:${room.code}:${t}`)
      socket.emit('team:join:accepted', { code: room.code, team: t })
      emitRoomState(room)
    })

    socket.on('host:configure', ({ code, settings }) => {
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return
      if (room.host.socketId !== socket.id) return

      const nextSettings = {
        category: typeof settings?.category === 'string' ? settings.category : 'All',
        count: typeof settings?.count === 'string' ? settings.count : 'all',
        shuffle: settings?.shuffle !== false,
      }

      room.settings = nextSettings
      room.questions = selectQuestions(nextSettings)
      room.phase = 'lobby'
      room.index = 0
      room.submissions = { A: null, B: null }
      room.scores = { A: 0, B: 0 }
      room.answerLog = []
      emitRoomState(room)
    })

    socket.on('host:start', ({ code }) => {
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return
      if (room.host.socketId !== socket.id) return
      if (!room.questions.length) room.questions = selectQuestions(room.settings)
      room.phase = 'question'
      room.index = 0
      room.submissions = { A: null, B: null }
      room.scores = { A: 0, B: 0 }
      room.answerLog = []
      emitRoomState(room)
    })

    socket.on('host:reveal', ({ code }) => {
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return
      if (room.host.socketId !== socket.id) return
      reveal(room)
    })

    socket.on('host:next', ({ code }) => {
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return
      if (room.host.socketId !== socket.id) return
      next(room)
    })

    socket.on('team:answer', ({ code, team, deviceId, index }) => {
      const room = getRoom(String(code || '').toUpperCase())
      const t = sanitizeTeam(team)
      const d = String(deviceId || '').trim()
      if (!room || !t) return
      if (room.phase !== 'question') return

      const slot = room.teams[t]
      if (!slot.deviceId || slot.deviceId !== d) return
      if (slot.socketId !== socket.id) return
      if (room.submissions[t]) return

      const q = room.questions[room.index]
      const idx = Math.max(0, Math.min(Number(index) || 0, (q?.answers || []).length - 1))
      room.submissions[t] = { index: idx, at: Date.now() }
      emitRoomState(room)
      socket.emit('team:answer:accepted', { index: idx })
    })

    socket.on('disconnect', () => {
      for (const room of rooms.values()) {
        if (room.host.socketId === socket.id) {
          room.host.connected = false
          room.host.socketId = null
        }

        ;(['A', 'B']).forEach((t) => {
          const slot = room.teams[t]
          if (slot.socketId === socket.id) {
            slot.connected = false
            slot.socketId = null
          }
        })
        emitRoomState(room)
      }
    })
  })

  if (isProd) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')))
  } else {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
  }

  app.get('/host', (req, res) => res.redirect('/host.html'))
  app.get('/team', (req, res) => res.redirect('/team.html'))
  app.get('/', (req, res) => res.redirect('/index.html'))

  server.listen(port, () => {
    console.log(`server running on http://127.0.0.1:${port}`)
  })
}

start()


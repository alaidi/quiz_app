const http = require('http')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const express = require('express')
const { Server } = require('socket.io')

function loadConfig() {
  try {
    const filePath = path.resolve(process.cwd(), 'server', 'config.json')
    if (!fs.existsSync(filePath)) return {}
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

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

function pickBestLanIp(ips) {
  const prefer = (prefix) => ips.find((ip) => ip.startsWith(prefix)) || null
  return (
    prefer('192.168.') ||
    prefer('10.') ||
    ips.find((ip) => !ip.startsWith('172.')) ||
    ips[0] ||
    null
  )
}

function getLanIps() {
  const ifaces = os.networkInterfaces()
  const ips = []
  for (const name of Object.keys(ifaces)) {
    for (const addr of ifaces[name] || []) {
      if (addr.family !== 'IPv4') continue
      if (addr.internal) continue
      ips.push(addr.address)
    }
  }
  return Array.from(new Set(ips))
}

function parseCookies(header) {
  const out = {}
  const raw = String(header || '')
  if (!raw) return out
  raw.split(';').forEach((part) => {
    const [k, ...rest] = part.trim().split('=')
    if (!k) return
    out[k] = decodeURIComponent(rest.join('=') || '')
  })
  return out
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
  const config = loadConfig()
  const isProd = process.env.NODE_ENV === 'production'
  const port = Number(process.env.PORT || config.port || 5173)
  const bindHost = String(process.env.HOST || config.bindHost || '0.0.0.0')
  const explicitPublicBaseUrl = String(process.env.PUBLIC_BASE_URL || config.publicBaseUrl || '').trim()
  const lanIps = getLanIps()
  const bestIp = pickBestLanIp(lanIps)
  const recommendedBaseUrl = explicitPublicBaseUrl || (bestIp ? `http://${bestIp}:${port}` : `http://127.0.0.1:${port}`)

  const app = express()
  app.use(express.json())
  const server = http.createServer(app)
  const io = new Server(server, { cors: { origin: true, credentials: true } })

  const rooms = new Map()

  const soloAuth = config.soloAuth && typeof config.soloAuth === 'object' ? config.soloAuth : {}
  const soloAuthEnabled = soloAuth.enabled === true
  const soloUsername = String(soloAuth.username || '')
  const soloPassword = String(soloAuth.password || '')

  const soloSessions = new Map()

  function createSoloToken() {
    return crypto.randomBytes(24).toString('hex')
  }

  function getSoloToken(req) {
    const cookies = parseCookies(req.headers.cookie)
    return cookies.solo_token || ''
  }

  function isSoloAuthed(req) {
    if (!soloAuthEnabled) return true
    const token = getSoloToken(req)
    if (!token) return false
    const session = soloSessions.get(token)
    if (!session) return false
    if (session.expiresAt < Date.now()) {
      soloSessions.delete(token)
      return false
    }
    return true
  }

  function isSoloAuthedSocket(socket) {
    if (!soloAuthEnabled) return true
    const cookies = parseCookies(socket.request?.headers?.cookie)
    const token = cookies.solo_token || ''
    if (!token) return false
    const session = soloSessions.get(token)
    if (!session) return false
    if (session.expiresAt < Date.now()) {
      soloSessions.delete(token)
      return false
    }
    return true
  }

  function setSoloCookie(res, token) {
    const parts = [`solo_token=${encodeURIComponent(token)}`, 'Path=/', 'SameSite=Lax']
    res.setHeader('Set-Cookie', parts.join('; '))
  }

  function clearSoloCookie(res) {
    res.setHeader('Set-Cookie', 'solo_token=; Path=/; Max-Age=0; SameSite=Lax')
  }

  app.get('/api/solo/session', (req, res) => {
    if (!soloAuthEnabled) return res.json({ ok: true, enabled: false })
    if (isSoloAuthed(req)) return res.json({ ok: true, enabled: true })
    return res.status(401).json({ ok: false, enabled: true })
  })

  app.post('/api/solo/login', (req, res) => {
    if (!soloAuthEnabled) return res.json({ ok: true, enabled: false })

    const username = String(req.body?.username || '')
    const password = String(req.body?.password || '')

    if (username !== soloUsername || password !== soloPassword) {
      return res.status(401).json({ ok: false, message: 'Invalid username or password' })
    }

    const token = createSoloToken()
    soloSessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
    setSoloCookie(res, token)
    return res.json({ ok: true })
  })

  app.post('/api/solo/logout', (req, res) => {
    const token = getSoloToken(req)
    if (token) soloSessions.delete(token)
    clearSoloCookie(res)
    res.json({ ok: true })
  })

  app.use((req, res, next) => {
    const pathname = String(req.path || '')
    if (!soloAuthEnabled) return next()
    if (
      pathname === '/solo.html' ||
      pathname === '/host.html' ||
      pathname === '/host' ||
      pathname === '/screen.html' ||
      pathname === '/screen'
    ) {
      if (!isSoloAuthed(req)) return res.redirect(302, `/login.html?redirect=${encodeURIComponent(pathname)}`)
    }
    next()
  })

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
      if (!isSoloAuthedSocket(socket)) return socket.emit('error:message', { message: 'Not authorized' })
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
      if (!isSoloAuthedSocket(socket)) return socket.emit('error:message', { message: 'Not authorized' })
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return socket.emit('error:message', { message: 'Room not found' })
      room.host.socketId = socket.id
      room.host.connected = true
      socket.join(`room:${room.code}`)
      socket.join(`host:${room.code}`)
      emitRoomState(room)
    })

    socket.on('screen:join', ({ code }) => {
      if (!isSoloAuthedSocket(socket)) return socket.emit('error:message', { message: 'Not authorized' })
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return socket.emit('error:message', { message: 'Room not found' })
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
      if (slot.connected && slot.deviceId && slot.deviceId !== d) {
        return socket.emit('team:join:denied', { message: 'This team is already connected on another device' })
      }

      if (slot.socketId && slot.socketId !== socket.id) {
        const existing = io.sockets.sockets.get(slot.socketId)
        existing?.disconnect(true)
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
      if (!isSoloAuthedSocket(socket)) return socket.emit('error:message', { message: 'Not authorized' })
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return
      if (room.host.socketId !== socket.id) return

      ;(['A', 'B']).forEach((t) => {
        const slot = room.teams[t]
        if (slot.socketId) {
          const existing = io.sockets.sockets.get(slot.socketId)
          existing?.disconnect(true)
        }
      })

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
      room.teams = {
        A: { deviceId: null, socketId: null, connected: false },
        B: { deviceId: null, socketId: null, connected: false },
      }
      emitRoomState(room)
    })

    socket.on('host:start', ({ code }) => {
      if (!isSoloAuthedSocket(socket)) return socket.emit('error:message', { message: 'Not authorized' })
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
      if (!isSoloAuthedSocket(socket)) return socket.emit('error:message', { message: 'Not authorized' })
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return
      if (room.host.socketId !== socket.id) return
      reveal(room)
    })

    socket.on('host:next', ({ code }) => {
      if (!isSoloAuthedSocket(socket)) return socket.emit('error:message', { message: 'Not authorized' })
      const room = getRoom(String(code || '').toUpperCase())
      if (!room) return
      if (room.host.socketId !== socket.id) return
      next(room)
    })

    socket.on('team:answer', ({ code, team, deviceId, index }) => {
      const room = getRoom(String(code || '').toUpperCase())
      const t = sanitizeTeam(team)
      const d = String(deviceId || '').trim()
      if (!room || !t) return socket.emit('team:answer:denied', { message: 'Room not found' })
      if (room.phase !== 'question') return socket.emit('team:answer:denied', { message: 'Not accepting answers right now' })

      const slot = room.teams[t]
      if (!slot.deviceId || slot.deviceId !== d) return socket.emit('team:answer:denied', { message: 'Device not authorized for this team' })
      if (slot.socketId !== socket.id) return socket.emit('team:answer:denied', { message: 'Not the active device for this team' })
      if (room.submissions[t]) return socket.emit('team:answer:denied', { message: 'Already submitted' })

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

  app.get('/api/info', (req, res) => {
    res.json({
      port,
      bindHost,
      publicBaseUrl: explicitPublicBaseUrl || '',
      lanIps,
      recommendedBaseUrl,
    })
  })

  let vite
  if (isProd) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')))
  } else {
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)

    app.use(async (req, res, next) => {
      try {
        const url = req.originalUrl.split('?')[0]
        const isHtml = url === '/' || url.endsWith('.html')
        if (!isHtml) return next()

        const file = url === '/' ? 'index.html' : url.slice(1)
        const filePath = path.resolve(process.cwd(), file)
        if (!fs.existsSync(filePath)) return next()

        const template = fs.readFileSync(filePath, 'utf8')
        const html = await vite.transformIndexHtml(req.originalUrl, template)
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
      } catch (e) {
        next(e)
      }
    })
  }

  app.get('/host', (req, res) => res.redirect('/host.html'))
  app.get('/team', (req, res) => res.redirect('/team.html'))
  app.get('/', (req, res) => res.redirect('/index.html'))

  server.listen(port, bindHost, () => {
    console.log(`server running on ${bindHost}:${port}`)
    console.log(`recommended LAN url: ${recommendedBaseUrl}`)
  })
}

start()

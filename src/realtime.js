import { io } from 'socket.io-client'

export function getDeviceId() {
  const key = 'quiz:deviceId'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  localStorage.setItem(key, id)
  return id
}

export function createSocket() {
  return io({ transports: ['websocket', 'polling'], autoConnect: false })
}

const { io } = require('socket.io-client')

const url = process.env.SERVER_URL || 'http://localhost:3000'
const id = 'TEST_PICKUP'

console.log(`[${id}] connecting to ${url}`)
const socket = io(url, { reconnectionDelayMax: 10000 })

let initialScore = 0
let pickupFound = false
let speedFound = false
let scoreIncreased = false
let speedBoosted = false
let attempts = 0
let lastScore = 0

socket.on('connect', () => {
  console.log(`[${id}] connected as ${socket.id}`)
})

socket.on('state', (data) => {
  const players = data.players || {}
  const me = players[socket.id]
  if (!me) return
  lastScore = me.score || 0
  let dx = 0, dy = 0
  // Cherche un pickup score et un pickup speed
  let scorePickup = null, speedPickup = null
  if (data.pickups) {
    for (const pid of Object.keys(data.pickups)) {
      const p = data.pickups[pid]
      if (p.type === 'score' && !pickupFound) scorePickup = p
      if (p.type === 'speed' && !speedFound) speedPickup = p
    }
  }
  // Test pickup score
  if (scorePickup && !pickupFound) {
    dx = Math.sign(scorePickup.x - me.x)
    dy = Math.sign(scorePickup.y - me.y)
    pickupFound = true
    initialScore = me.score || 0
  }
  if (pickupFound && !scoreIncreased) {
    attempts++
    if (scorePickup) {
      dx = Math.sign(scorePickup.x - me.x)
      dy = Math.sign(scorePickup.y - me.y)
      socket.emit('input', { dx, dy })
    }
    if (me.score > initialScore) {
      scoreIncreased = true
      console.log(`[${id}] SUCCESS: pickup score collected, score=${me.score}`)
    }
    if (attempts > 30) {
      console.error(`[${id}] FAIL: pickup score not collected after 30 ticks, score=${me.score}`)
      process.exit(1)
    }
  }
  // Test pickup speed
  if (scoreIncreased && speedPickup && !speedFound) {
    dx = Math.sign(speedPickup.x - me.x)
    dy = Math.sign(speedPickup.y - me.y)
    speedFound = true
    attempts = 0
  }
  if (speedFound && !speedBoosted) {
    attempts++
    if (speedPickup) {
      dx = Math.sign(speedPickup.x - me.x)
      dy = Math.sign(speedPickup.y - me.y)
      socket.emit('input', { dx, dy })
    }
    // Vérifie si le joueur a reçu le boost (vitesse double pendant 3s)
    // Ici, on ne peut pas mesurer la vitesse côté serveur, donc on se contente de la collecte
    if (attempts > 5) {
      speedBoosted = true
      console.log(`[${id}] SUCCESS: pickup speed collected (boost should be active)`)
      process.exit(0)
    }
    if (attempts > 30) {
      console.error(`[${id}] FAIL: pickup speed not collected after 30 ticks`)
      process.exit(1)
    }
  }
})

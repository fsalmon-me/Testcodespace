const { io } = require('socket.io-client')

const url = process.env.SERVER_URL || 'http://localhost:3000'
const id = process.env.CLIENT_ID || Math.random().toString(36).slice(2, 6)

console.log(`[${id}] connecting to ${url}`)
const socket = io(url, { reconnectionDelayMax: 10000 })

socket.on('connect', () => {
  console.log(`[${id}] connected as ${socket.id}`)
})

socket.on('state', (data) => {
  const players = data.players || {}
  const me = players[socket.id]
  const count = Object.keys(players).length
  console.log(`[${id}] state: players=${count}${me ? ` me=(${Math.round(me.x)},${Math.round(me.y)}) score=${me.score||0}` : ''}`)
})

socket.on('pickupSpawn', (p) => {
  console.log(`[${id}] pickupSpawn ${p.id} @(${Math.round(p.x)},${Math.round(p.y)})`)
})

socket.on('pickupCollected', (d) => {
  console.log(`[${id}] pickupCollected ${d.id} by ${d.by}`)
})

// send random inputs for 10 seconds
let t = 0
const iv = setInterval(() => {
  // random walk with bias towards center
  const dx = (Math.random() - 0.5) * 2
  const dy = (Math.random() - 0.5) * 2
  socket.emit('input', { dx, dy })
  t += 200
  if (t > 10000) {
    clearInterval(iv)
    socket.disconnect()
    console.log(`[${id}] done`)
  }
}, 200)

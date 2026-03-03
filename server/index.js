
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const PORT = process.env.PORT || 3000

// serve static client build if exists
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

const players = {}
const pickups = {}

// health endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', players: Object.keys(players).length, pickups: Object.keys(pickups).length }))
// structured logging util
function log(event, data) {
  console.log(JSON.stringify({ ts: Date.now(), event, ...data }))
}

function spawnPickup() {
  const id = 'pick-' + Math.random().toString(36).slice(2, 8)
  // 80% normal, 20% speed
  const types = ['score', 'speed']
  const type = Math.random() < 0.2 ? 'speed' : 'score'
  const color = type === 'speed' ? 0x00ffff : Math.floor(Math.random() * 0xffffff)
  const p = { id, x: 60 + Math.random() * 880, y: 60 + Math.random() * 520, color, type }
  pickups[id] = p
  return p
}

// spawn initial pickups
for (let i = 0; i < 6; i++) spawnPickup()

function randomColor() {
  return Math.floor(Math.random() * 0xffffff)
}

io.on('connection', (socket) => {
  log('connect', { id: socket.id })
  // spawn player
  players[socket.id] = { x: Math.random() * 800 + 80, y: Math.random() * 400 + 80, color: randomColor(), id: socket.id, score: 0 }
  socket.emit('spawn', players[socket.id])
  log('spawn', { id: socket.id, player: players[socket.id] })

  socket.on('input', (data) => {
    const p = players[socket.id]
    if (!p) return
    // simple velocity assignment
    const speed = 200
    p.vx = (data.dx || 0) * speed
    p.vy = (data.dy || 0) * speed
    // record last acknowledged sequence from this client (if provided)
    if (data.seq) p.lastSeqAck = data.seq
    log('input', { id: socket.id, dx: data.dx, dy: data.dy, seq: data.seq })
  })

  socket.on('ping', (t0) => {
    socket.emit('pong', t0)
  })

  socket.on('disconnect', () => {
    log('disconnect', { id: socket.id })
    delete players[socket.id]
    io.emit('despawn', socket.id)
  })
})

// authoritative tick
setInterval(() => {
  const dt = 1 / 20
  for (const id in players) {
    const p = players[id]
    p.x = (p.x || 0) + (p.vx || 0) * dt
    p.y = (p.y || 0) + (p.vy || 0) * dt
    // simple bounds
    p.x = Math.max(20, Math.min(940, p.x))
    p.y = Math.max(20, Math.min(620, p.y))
  }
  // check pickups collisions
  for (const pid in pickups) {
    const pick = pickups[pid]
    for (const id in players) {
      const pl = players[id]
      const dx = pl.x - pick.x
      const dy = pl.y - pick.y
      const dist2 = dx * dx + dy * dy
      if (dist2 < 24 * 24) {
        // collect
        if (pick.type === 'score') {
          pl.score = (pl.score || 0) + 1
        }
        if (pick.type === 'speed') {
          pl.speedBoost = Date.now() + 3000 // 3s boost
        }
        // notify clients for effect
        io.emit('pickupCollected', { id: pid, x: pick.x, y: pick.y, by: id, type: pick.type })
        log('pickup', { id: pid, by: id, type: pick.type })
        // remove and respawn
        delete pickups[pid]
        const np = spawnPickup()
        io.emit('pickupSpawn', np)
        break
      }
    }
  }
  // emit state including lastSeqAck per player for reconciliation
  io.emit('state', { players, pickups })
}, 50)

server.listen(PORT, () => console.log('Server listening on', PORT))

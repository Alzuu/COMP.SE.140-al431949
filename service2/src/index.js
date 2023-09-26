const express = require('express')
const fs = require('fs').promises

const app = express()
const port = 8000

const logFile = '../logs/service2.log'

app.use(express.json())

app.post('/', async (req, res) => {
  try {
    if (req.body && req.body.data !== 'STOP') {
      const data = `${req.body.data} ${req.socket.remoteAddress}:${req.socket.remotePort}\n`
      res.send(data)
      await fs.writeFile(logFile, data, { flag: 'a+' })
    }
  } catch (error) {
    console.log(error)
  }
})

setTimeout(() => {
  app.listen(port, () => {
    console.log(`Service2 listening on port ${port}`)
    fs.writeFile(logFile, '', { flag: 'w' })
  })
}, 2000)

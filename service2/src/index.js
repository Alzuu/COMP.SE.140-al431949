const express = require('express')
const fs = require('fs').promises

// Create an Express app and specify the port
const app = express()
const port = 8000

// Define the log file path
const logFile = '../logs/service2.log'

// Parse incoming JSON requests
app.use(express.json())

// Handle POST requests to the root path
app.post('/', async (req, res) => {
  try {
    // Check if the request data is not 'STOP'
    if (req.body && req.body.data !== 'STOP') {
      // Create a log entry with data and client info
      const data = `${req.body.data} ${req.socket.remoteAddress}:${req.socket.remotePort}\n`

      // Send the log data as a response and save it to the log file
      res.send(data)
      await fs.writeFile(logFile, data, { flag: 'a+' })
    }
  } catch (error) {
    // Log errors
    console.log(error)
  }
})

// Start the server after a 2-second delay
setTimeout(() => {
  app.listen(port, () => {
    // Log server start and clear the log file
    console.log(`Service2 listening on port ${port}`)
    fs.writeFile(logFile, '', { flag: 'w' })
  })
}, 2000)

import express from 'express'

// Create an Express app and specify the port
const app = express()
const port = 8083

const server = app.listen(port, async () => {
  // Log server start and clear the log file
  console.log(`API-gateway started on port ${port}`)
})

export default server

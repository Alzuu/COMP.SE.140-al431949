import express from 'express'
import amqp from 'amqplib'

const State = {
  INIT: 'INIT',
  PAUSED: 'PAUSED',
  RUNNING: 'RUNNING',
  SHUTDOWN: 'SHUTDOWN'
}

// Create an Express app and specify the port
const app = express()
const port = 8000

app.use(express.json())

const MQHost = process.env.MQ_HOST
const MQPort = process.env.MQ_PORT

const exchange = 'topic_logs'
const msgQueue = 'msgQueue'
const logQueue = 'logQueue'
const stateQueue = 'state_service2'

let channel
let state = State.INIT

// Handle POST requests to the root path
app.post('/', (req, res) => {
  if (state !== State.RUNNING) {
    res.status(503).send()
    return
  }

  try {
    if (req.body) {
      // Create a log entry with data and client info
      const data = `${req.body.data} ${req.socket.remoteAddress}:${req.socket.remotePort}`

      // Publish log to the message queue
      channel.publish(
        exchange,
        'log.#',
        // Slice used to remove unnecessary double quotes
        Buffer.from(JSON.stringify(data).slice(1, -1), 'utf8')
      )

      // Send an empty response with status code 200
      res.status(200).send()
    }
  } catch (error) {
    // Log errors
    console.log(error)
  }
})

// Start the server after a 2-second delay
setTimeout(() => {
  app.listen(port, async () => {
    // Log server start and clear the log file
    console.log(`Service2 listening on port ${port}`)
    channel = await initAmqp(MQHost, MQPort)
    // Listen for messages
    channel.consume(
      msgQueue,
      (msg) => {
        if (!msg) return
        const log = msg.content.toString() + ' MSG'
        channel.publish(exchange, 'log.#', Buffer.from(log, 'utf8'))
      },
      {
        noAck: true
      }
    )
    handleStateChange({ content: State.RUNNING })
  })
}, 2000)

/**
 * Initialize ampq connection, bind message queues and return the amqp channel
 *
 * @param {String} host hostname to connect to
 * @param {String} port port to connect to
 * @returns {Promise<amqp.Channel>} amqp channel
 */
const initAmqp = async (host, port) => {
  try {
    const connection = await amqp.connect(`amqp://${host}:${port}`)
    const channel = await connection.createChannel()
    await channel.assertExchange(exchange, 'topic', { durable: true })

    await channel.assertQueue(msgQueue, { durable: true })
    await channel.bindQueue(msgQueue, exchange, 'message.#')

    await channel.assertQueue(logQueue, { durable: true })
    await channel.bindQueue(logQueue, exchange, 'log.#')

    await channel.assertQueue(stateQueue, { durable: true })
    await channel.bindQueue(stateQueue, exchange, stateQueue)
    await channel.consume(stateQueue, handleStateChange, {
      noAck: true
    })

    return channel
  } catch (error) {
    console.log('Service2 AMQP init: ', error)
    throw error
  }
}

const handleStateChange = (msg) => {
  if (!msg) return
  const newState = msg.content.toString()
  if (!State[newState]) return
  else if (newState === State.SHUTDOWN) shutDown()
  else if (newState === State.INIT) state = State.RUNNING
  else state = newState
}

const shutDown = async () => {
  try {
    await channel.close()
    process.exit(0)
  } catch (error) {
    console.log('Service2 shutdown: ', error)
    process.exit(1)
  }
}

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

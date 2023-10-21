import express from 'express'
import amqp from 'amqplib'

// Create an Express app and specify the port
const app = express()
const port = 8000

app.use(express.json())

const MQHost = process.env.MQ_HOST
const MQPort = process.env.MQ_PORT

const exchange = 'topic_logs'
const msgQueue = 'msgQueue'
const logQueue = 'logQueue'

let channel

// Handle POST requests to the root path
app.post('/', (req, res) => {
  try {
    if (req.body) {
      // Create a log entry with data and client info
      const data = `${req.body.data} ${req.socket.remoteAddress}:${req.socket.remotePort}`

      channel.publish(
        exchange,
        'log.#',
        Buffer.from(JSON.stringify(data).slice(1, -1), 'utf8')
      )

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
    channel = await initAmqp()
    // Listen for messages
    channel.consume(
      msgQueue,
      (msg) => {
        if (!msg) return
        const log = msg.content.toString() + ' MSG'
        channel.publish(exchange, 'log.#', Buffer.from(log, 'utf8'))
      },
      {
        noAck: true,
      }
    )
  })
}, 2000)

const initAmqp = async () => {
  try {
    const connection = await amqp.connect(`amqp://${MQHost}:${MQPort}`)
    const channel = await connection.createChannel()
    await channel.assertExchange(exchange, 'topic', { durable: true })

    await channel.assertQueue(msgQueue, { durable: true })
    await channel.bindQueue(msgQueue, exchange, 'message.#')

    await channel.assertQueue(logQueue, { durable: true })
    await channel.bindQueue(logQueue, exchange, 'log.#')

    return channel
  } catch (error) {
    console.log('Service2 AMQP init: ', error)
    throw error
  }
}

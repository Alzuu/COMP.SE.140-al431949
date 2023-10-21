import express from 'express'
import amqp from 'amqplib'

// Create an Express app and specify the port
const app = express()
const port = 8087

const MQHost = process.env.MQ_HOST
const MQPort = process.env.MQ_PORT

// Define the array of messages
const messages = []

const logQueue = 'logQueue'
const exchange = 'topic_logs'

// Handle GET requests to the root path
app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send(messages.join('\n'))
})

app.listen(port, async () => {
  // Log server start
  console.log(`Monitor listening on port ${port}`)
  await initAmqp()
})

const initAmqp = async () => {
  try {
    const connection = await amqp.connect(`amqp://${MQHost}:${MQPort}`)
    const channel = await connection.createChannel()
    await channel.assertExchange(exchange, 'topic', { durable: true })

    await channel.assertQueue(logQueue, { durable: true })
    await channel.bindQueue(logQueue, exchange, 'log.#')

    // Listen for messages
    channel.consume(
      logQueue,
      (msg) => {
        if (!msg) return
        console.log(`Monitor: Received message ${msg.content.toString('utf8')}`)
        messages.push(msg.content.toString())
      },
      {
        noAck: true,
      }
    )

    return channel
  } catch (error) {
    console.log('Monitor AMQP init: ', error)
    throw error
  }
}

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
const port = 8087

const MQHost = process.env.MQ_HOST
const MQPort = process.env.MQ_PORT
const MQLogQueue = process.env.MQ_LOG_QUEUE
const MQExchange = process.env.MQ_EXCHANGE
const MQLogRoutingKey = process.env.MQ_LOG_ROUTING_KEY
const MQStateQueue = process.env.MQ_STATE_QUEUE
const MQStateMonitorRoutingKey = process.env.MQ_STATE_MONITOR_ROUTING_KEY

// Define the array of messages
const messages = []

let channel

// Handle GET requests to the root path
app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.status(200).send(messages.join('\n'))
})

const server = app.listen(port, async () => {
  // Log server start
  console.log(`Monitor listening on port ${port}`)
  channel = await initAmqp(MQHost, MQPort)
  // Listen for messages
  channel.consume(
    MQLogQueue,
    (msg) => {
      if (!msg) return
      console.log(`Monitor: Received message ${msg.content.toString('utf8')}`)
      messages.push(msg.content.toString())
    },
    {
      noAck: true
    }
  )
})

/**
 * Initialize ampq connection, bind log queue and return the amqp channel
 *
 * @param {String} host hostname to connect to
 * @param {String} port port to connect to
 * @returns {Promise<amqp.Channel>} amqp channel
 */
const initAmqp = async (host, port) => {
  try {
    const connection = await amqp.connect(`amqp://${host}:${port}`)
    const channel = await connection.createChannel()
    await channel.assertExchange(MQExchange, 'topic', { durable: true })

    await channel.assertQueue(MQLogQueue, { durable: true })
    await channel.bindQueue(MQLogQueue, MQExchange, MQLogRoutingKey)

    await channel.assertQueue(MQStateQueue, { durable: true })
    await channel.bindQueue(MQStateQueue, MQExchange, MQStateMonitorRoutingKey)
    await channel.consume(MQStateQueue, handleStateChange, {
      noAck: true
    })

    return channel
  } catch (error) {
    console.log('Monitor AMQP init: ', error)
    throw error
  }
}

const handleStateChange = (msg) => {
  if (!msg) return
  const newState = msg.content.toString()
  if (newState === State.SHUTDOWN) shutDown()
}
const shutDown = async () => {
  try {
    await channel.close()
    process.exit(0)
  } catch (error) {
    console.log('Monitor shutdown: ', error)
    process.exit(1)
  }
}

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

export default server

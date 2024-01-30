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
const port = 8083

const MQHost = process.env.MQ_HOST
const MQPort = process.env.MQ_PORT
const MQExchange = process.env.MQ_EXCHANGE
const MQStateQueue = process.env.MQ_STATE_QUEUE
const MQStateRoutingKeys = {
  MQStateMonitorRoutingKey: process.env.MQ_STATE_MONITOR_ROUTING_KEY,
  MQStateService1RoutingKey: process.env.MQ_STATE_SERVICE1_ROUTING_KEY,
  MQStateService2RoutingKey: process.env.MQ_STATE_SERVICE2_ROUTING_KEY
}
const MonitorHost = process.env.MONITOR_HOST
const MonitorPort = process.env.MONITOR_PORT

app.use(express.text())

let state = State.INIT
const runLogs = []

let channel

const init = async () => {
  const newState = State.RUNNING
  generateRunLog(state, newState)
  state = newState
  for (const stateQueue in MQStateRoutingKeys) {
    if (channel)
      await channel.publish(
        MQExchange,
        MQStateRoutingKeys[stateQueue],
        Buffer.from(newState, 'utf8')
      )
  }
}

const server = app.listen(port, async () => {
  console.log(`API-gateway listening on port ${port}`)

  if (MQHost && MQPort) channel = await initAmqp(MQHost, MQPort)
  init()
})

app.get('/messages', async (req, res) => {
  try {
    const messages = await (
      await fetch(`http://${MonitorHost}:${MonitorPort}`)
    ).text()
    res.setHeader('Content-Type', 'text/plain')
    res.status(200)
    res.send(messages)
  } catch (error) {
    res.status(404).send()
  }
})

app.put('/state', async (req, res) => {
  const newState = req.body
  if (Object.values(State).includes(newState)) {
    if (newState !== state) {
      generateRunLog(state, newState)
      for (const stateQueue in MQStateRoutingKeys) {
        if (channel)
          await channel.publish(
            MQExchange,
            MQStateRoutingKeys[stateQueue],
            Buffer.from(newState, 'utf8')
          )
      }
      state = newState
    }
    res.status(200).send()
    // Channel added in conditional for testing purposes
    if (newState === State.SHUTDOWN && channel) {
      shutDown()
    }
    if (newState === State.INIT && channel) {
      init()
    }
  } else {
    res.status(400).send()
  }
})

app.get('/state', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.status(200).send(state)
})

app.get('/run-log', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.status(200).send(runLogs.join('\n'))
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

    await channel.assertQueue(MQStateQueue, { durable: true })
    for (const key in MQStateRoutingKeys) {
      await channel.bindQueue(MQStateQueue, MQExchange, MQStateRoutingKeys[key])
    }

    return channel
  } catch (error) {
    console.log('Monitor AMQP init: ', error)
    throw error
  }
}

const generateRunLog = (state, newState) => {
  if (!State[state] || !State[newState]) return
  const currentDatetime = new Date().toISOString().replace(/\.\d{3}/, '')
  const log = `${currentDatetime}: ${state}->${newState}`
  runLogs.push(log)
}

const shutDown = async () => {
  try {
    await channel.close()
    process.exit(0)
  } catch (error) {
    console.log('API-gateway shutdown: ', error)
    process.exit(1)
  }
}

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)

export default server

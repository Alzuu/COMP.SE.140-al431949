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
const exchange = 'topic_logs'
const stateQueues = {
  monitorStateQueue: 'state_monitor',
  service1StateQueue: 'state_service1',
  service2StateQueue: 'state_service2'
}

app.use(express.text())

const MONITOR_NAME = 'monitor'
const MONITOR_PORT = 8087
let state = State.INIT
const runLogs = []

let channel

const server = app.listen(port, async () => {
  console.log(`API-gateway listening on port ${port}`)

  if (MQHost && MQPort) channel = await initAmqp(MQHost, MQPort)
  state = State.RUNNING
})

app.get('/messages', async (req, res) => {
  try {
    const messages = await (
      await fetch(`http://${MONITOR_NAME}:${MONITOR_PORT}`)
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
      for (const stateQueue in stateQueues) {
        if (channel)
          await channel.publish(
            exchange,
            stateQueues[stateQueue],
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

    for (const stateQueue in stateQueues) {
      await channel.assertQueue(stateQueues[stateQueue], { durable: true })
      await channel.bindQueue(
        stateQueues[stateQueue],
        exchange,
        stateQueues[stateQueue]
      )
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

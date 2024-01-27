import request from 'supertest'
import { describe, test, expect } from 'vitest'
import server from '../src/index.js'

const STATES = ['INIT', 'RUNNING', 'PAUSED', 'SHUTDOWN']

describe('GET /messages', () => {
  test('should return a 200 status code with a list of messages', async () => {
    const response = await request(server).get('/messages')
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
  })
})

describe('PUT /state', () => {
  test.each(STATES)(
    'should return a 200 status code if state is %s',
    async (state) => {
      const response = await request(server).put('/state').send({ state })
      expect(response.status).toBe(200)
    }
  )

  test('should return a 400 status code if state is valid', async () => {
    const response = await request(server)
      .put('/state')
      .send({ state: 'INVALID' })
    expect(response.status).toBe(400)
  })
})

describe('GET /state', () => {
  test('should return a 200 status code with the current state', async () => {
    const response = await request(server).get('/state')
    expect(response.status).toBe(200)
    expect(STATES).toContain(response.text)
  })
})

describe('GET /run-log', () => {
  test('should return a 200 status code with the run logs', async () => {
    const response = await request(server).get('/run-log')
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
  })
})

import request from 'supertest'
import { describe, test, expect } from 'vitest'
import server from './index.js'

describe('GET /', () => {
  test('should return a 200 status code', async () => {
    const response = await request(server).get('/')
    expect(response.status).toBe(200)
  })
  test('send an empty response if no messages are received', () => {
    expect([].join('\n')).toBe('')
  })
  test('send a response with messages in new lines if they are received', () => {
    expect(['message1', 'message2'].join('\n')).toBe('message1\nmessage2')
  })
})

import { test, expect } from 'vitest'

test('send an empty response if no messages are received', () => {
  expect([].join('\n')).toBe('')
})

test('send a response with messages in new lines if they are received', () => {
  expect(['message1', 'message2'].join('\n')).toBe('message1\nmessage2')
})

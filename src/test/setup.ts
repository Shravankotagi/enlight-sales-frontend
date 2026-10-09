import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Tests run offline. Any request that escapes a mock fails loudly instead of
// reaching the backend or Supabase.
const blockedFetch = (input: RequestInfo | URL) => {
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return Promise.reject(
    new Error(`Network access is blocked in tests (attempted: ${target}). Mock the dependency instead.`),
  )
}
vi.stubGlobal('fetch', blockedFetch)

class BlockedXMLHttpRequest {
  open(_method: string, url: string) {
    throw new Error(`Network access is blocked in tests (attempted: ${url}). Mock the dependency instead.`)
  }
}
vi.stubGlobal('XMLHttpRequest', BlockedXMLHttpRequest)

afterEach(() => {
  cleanup()
})

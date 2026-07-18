/**
 * Tests for the `serialize` mutation option.
 *
 * The `serialize` option maps to TanStack Query v5's `scope: { id }` mechanism:
 * mutations sharing the same scope id run serially in submission order. The
 * second mutation is paused until the first settles (success or error).
 *
 * `serialize: true`      → scope id derived from the operation's resolved path
 * `serialize: 'group'`   → that string used verbatim as the scope id
 * explicit `scope` wins over `serialize` (dev warning emitted when both set)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope } from 'vue'
import { createApiClient } from '../fixtures/api-client'
import { createTestScope } from '../helpers'
import { mockAxios } from '../setup'

describe('serialize mutation option', () => {
  let api: ReturnType<typeof createApiClient>
  let scope: ReturnType<typeof effectScope>
  let run: <T>(fn: () => T) => T

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope, run } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  // ---------------------------------------------------------------------------
  // (a) Two mutateAsync calls with serialize:true run sequentially
  // ---------------------------------------------------------------------------
  it('two mutateAsync calls with serialize:true run sequentially — 2nd starts only after 1st resolves', async () => {
    const mutation = run(() => api.createPet.useMutation({ serialize: true }))

    // Deferred-promise pattern: we control when each axios call settles
    let resolveFirst!: () => void
    let resolveSecond!: () => void

    const firstStarted = vi.fn()
    const secondStarted = vi.fn()

    mockAxios.mockImplementationOnce(() => {
      firstStarted()
      return new Promise((r) => {
        resolveFirst = () => r({ data: { id: '1', name: 'First' } })
      })
    })
    mockAxios.mockImplementationOnce(() => {
      secondStarted()
      return new Promise((r) => {
        resolveSecond = () => r({ data: { id: '2', name: 'Second' } })
      })
    })

    // Fire both calls without awaiting — they run in parallel at the JS level
    const p1 = mutation.mutateAsync({ data: { name: 'First' } })
    const p2 = mutation.mutateAsync({ data: { name: 'Second' } })

    // Give the event loop a moment to start the first mutation
    await new Promise((r) => setTimeout(r, 10))

    // First should have started, second should still be waiting (scope-queued)
    expect(firstStarted).toHaveBeenCalledTimes(1)
    expect(secondStarted).toHaveBeenCalledTimes(0)

    // Resolve the first call
    resolveFirst()
    await p1

    // Give the mutation cache a tick to enqueue the next mutation
    await new Promise((r) => setTimeout(r, 10))

    // Now the second should have started
    expect(secondStarted).toHaveBeenCalledTimes(1)

    resolveSecond()
    await p2

    expect(mockAxios).toHaveBeenCalledTimes(2)
  })

  // ---------------------------------------------------------------------------
  // (b) Guard test: without serialize, same two calls run concurrently
  // ---------------------------------------------------------------------------
  it('without serialize, two calls run concurrently', async () => {
    const mutation = run(() => api.createPet.useMutation())

    let resolveFirst!: () => void
    let resolveSecond!: () => void

    const firstStarted = vi.fn()
    const secondStarted = vi.fn()

    mockAxios.mockImplementationOnce(() => {
      firstStarted()
      return new Promise((r) => {
        resolveFirst = () => r({ data: { id: '1', name: 'First' } })
      })
    })
    mockAxios.mockImplementationOnce(() => {
      secondStarted()
      return new Promise((r) => {
        resolveSecond = () => r({ data: { id: '2', name: 'Second' } })
      })
    })

    const p1 = mutation.mutateAsync({ data: { name: 'First' } })
    const p2 = mutation.mutateAsync({ data: { name: 'Second' } })

    // Give both a moment to start
    await new Promise((r) => setTimeout(r, 10))

    // Both should run concurrently — both axios calls started before the first resolved
    expect(firstStarted).toHaveBeenCalledTimes(1)
    expect(secondStarted).toHaveBeenCalledTimes(1)

    resolveFirst()
    resolveSecond()
    await Promise.all([p1, p2])
  })

  // ---------------------------------------------------------------------------
  // (c) serialize:'group' shares scope across two different operations
  // ---------------------------------------------------------------------------
  it("serialize:'group' queues two different operations behind each other", async () => {
    // Two distinct operations that share the same string scope
    const updateMutation = run(() => api.updatePet.useMutation({ petId: '42' }, { serialize: 'group' }))
    const deleteMutation = run(() => api.deletePet.useMutation({ petId: '42' }, { serialize: 'group' }))

    let resolveUpdate!: () => void
    let resolveDelete!: () => void

    const updateStarted = vi.fn()
    const deleteStarted = vi.fn()

    mockAxios.mockImplementationOnce(() => {
      updateStarted()
      return new Promise((r) => {
        resolveUpdate = () => r({ data: { id: '42', name: 'Updated' } })
      })
    })
    mockAxios.mockImplementationOnce(() => {
      deleteStarted()
      return new Promise((r) => {
        resolveDelete = () => r({ data: {} })
      })
    })

    const p1 = updateMutation.mutateAsync({ data: { name: 'Updated' } })
    const p2 = deleteMutation.mutateAsync()

    await new Promise((r) => setTimeout(r, 10))

    // update started, delete is queued
    expect(updateStarted).toHaveBeenCalledTimes(1)
    expect(deleteStarted).toHaveBeenCalledTimes(0)

    resolveUpdate()
    await p1

    await new Promise((r) => setTimeout(r, 10))

    // Now delete should have started
    expect(deleteStarted).toHaveBeenCalledTimes(1)

    resolveDelete()
    await p2
  })

  // ---------------------------------------------------------------------------
  // (c2) serialize:'' (empty string) is used verbatim and still serializes
  // ---------------------------------------------------------------------------
  it("serialize:'' (empty string) is a valid verbatim scope id and serializes", async () => {
    const first = run(() => api.createPet.useMutation({ serialize: '' }))
    const second = run(() => api.createPet.useMutation({ serialize: '' }))

    let resolveFirst!: () => void
    const firstStarted = vi.fn()
    const secondStarted = vi.fn()

    mockAxios.mockImplementationOnce(() => {
      firstStarted()
      return new Promise((r) => {
        resolveFirst = () => r({ data: { id: '1', name: 'A' } })
      })
    })
    mockAxios.mockImplementationOnce(() => {
      secondStarted()
      return Promise.resolve({ data: { id: '2', name: 'B' } })
    })

    const p1 = first.mutateAsync({ data: { name: 'A' } })
    const p2 = second.mutateAsync({ data: { name: 'B' } })

    await new Promise((r) => setTimeout(r, 10))

    // First started, second queued behind the shared empty-string scope
    expect(firstStarted).toHaveBeenCalledTimes(1)
    expect(secondStarted).toHaveBeenCalledTimes(0)

    resolveFirst()
    await Promise.all([p1, p2])
    expect(secondStarted).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // (d) Explicit scope + serialize → explicit scope wins, dev warning emitted once
  // ---------------------------------------------------------------------------
  it('explicit scope takes precedence over serialize and emits a dev warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const explicitScopeId = 'my-explicit-scope'
    const mutation = run(() =>
      api.createPet.useMutation({
        scope: { id: explicitScopeId },
        serialize: true,
      }),
    )

    mockAxios.mockResolvedValueOnce({ data: { id: '1', name: 'Test' } })

    await mutation.mutateAsync({ data: { name: 'Test' } })

    // Warning should have been emitted exactly once (at hook creation time)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('serialize')
    expect(warnSpy.mock.calls[0][0]).toContain('scope')

    // The actual request should have gone through (explicit scope did not block it)
    expect(mockAxios).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  // ---------------------------------------------------------------------------
  // (e) Order preservation: payloads arrive in submission order
  // ---------------------------------------------------------------------------
  it('payloads arrive server-side in submission order', async () => {
    const mutation = run(() => api.createPet.useMutation({ serialize: true }))

    const callOrder: string[] = []

    let resolveFirst!: () => void
    let resolveSecond!: () => void
    let resolveThird!: () => void

    mockAxios.mockImplementationOnce((cfg: { data: { name: string } }) => {
      callOrder.push(cfg.data.name)
      return new Promise((r) => {
        resolveFirst = () => r({ data: { id: '1', name: cfg.data.name } })
      })
    })
    mockAxios.mockImplementationOnce((cfg: { data: { name: string } }) => {
      callOrder.push(cfg.data.name)
      return new Promise((r) => {
        resolveSecond = () => r({ data: { id: '2', name: cfg.data.name } })
      })
    })
    mockAxios.mockImplementationOnce((cfg: { data: { name: string } }) => {
      callOrder.push(cfg.data.name)
      return new Promise((r) => {
        resolveThird = () => r({ data: { id: '3', name: cfg.data.name } })
      })
    })

    const p1 = mutation.mutateAsync({ data: { name: 'Alpha' } })
    const p2 = mutation.mutateAsync({ data: { name: 'Beta' } })
    const p3 = mutation.mutateAsync({ data: { name: 'Gamma' } })

    await new Promise((r) => setTimeout(r, 10))

    resolveFirst()
    await p1
    await new Promise((r) => setTimeout(r, 10))

    resolveSecond()
    await p2
    await new Promise((r) => setTimeout(r, 10))

    resolveThird()
    await p3

    expect(callOrder).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  // ---------------------------------------------------------------------------
  // (f) Error in first mutation does not block the queued second
  // ---------------------------------------------------------------------------
  it('error in first mutation does not block the queued second', async () => {
    const mutation = run(() => api.createPet.useMutation({ serialize: true }))

    let rejectFirst!: (reason: Error) => void
    let resolveSecond!: () => void

    const secondStarted = vi.fn()

    mockAxios.mockImplementationOnce(() => {
      return new Promise((_resolve, reject) => {
        rejectFirst = reject
      })
    })
    mockAxios.mockImplementationOnce(() => {
      secondStarted()
      return new Promise((r) => {
        resolveSecond = () => r({ data: { id: '2', name: 'Second' } })
      })
    })

    const p1 = mutation.mutateAsync({ data: { name: 'Fail' } })
    const p2 = mutation.mutateAsync({ data: { name: 'Second' } })

    await new Promise((r) => setTimeout(r, 10))

    // Reject the first mutation
    rejectFirst(new Error('network error'))
    await expect(p1).rejects.toThrow('network error')

    // Give the cache a tick to move to the next mutation
    await new Promise((r) => setTimeout(r, 10))

    // Second should now have started despite the first failing
    expect(secondStarted).toHaveBeenCalledTimes(1)

    resolveSecond()
    const result = await p2
    expect(result.data).toEqual({ id: '2', name: 'Second' })
  })

  // ---------------------------------------------------------------------------
  // Smoke test: serialize does not leak into axios call config
  // ---------------------------------------------------------------------------
  it('serialize option is not forwarded to axios request config', async () => {
    const mutation = run(() => api.createPet.useMutation({ serialize: true }))

    mockAxios.mockResolvedValueOnce({ data: { id: '1', name: 'Test' } })

    await mutation.mutateAsync({ data: { name: 'Test' } })

    const callArg = (mockAxios as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(callArg).not.toHaveProperty('serialize')
  })
})

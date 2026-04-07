import { vi } from 'vitest'

export const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auction: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  bid: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  notification: {
    create: vi.fn(),
    createMany: vi.fn(),
  },
  beat: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (callback) => {
    // Mock transaction - pass the prismaMock to the callback
    return callback(prismaMock)
  }),
}

export default prismaMock

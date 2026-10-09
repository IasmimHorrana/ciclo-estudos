import { describe, expect, it } from 'vitest'
import { lerPassos } from '@/dominio/passos'

describe('lerPassos', () => {
  it('lê números separados por espaço, com vírgula decimal', () => {
    expect(lerPassos('1 10')).toEqual([1, 10])
    expect(lerPassos(' 0,5   15 ')).toEqual([0.5, 15])
  })
  it('recusa letras, zero e negativos', () => {
    expect(lerPassos('1 dez')).toBeNull()
    expect(lerPassos('0')).toBeNull()
    expect(lerPassos('-5')).toBeNull()
  })
})

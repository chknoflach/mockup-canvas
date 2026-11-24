import { describe, expect, it } from 'vitest'
import { indexToLetter, nextNoteLetter } from '../src/notes'
import type { CanvasNote } from '../src/types'

function makeNote(letter: string, status: 'open' | 'resolved' = 'open'): CanvasNote {
  return {
    id: `n-${letter}`,
    letter,
    pageId: 'checkout',
    mockupId: 'A.1',
    mockupTitle: 'Default',
    x: 10,
    y: 10,
    text: '',
    element: { tag: 'button', selector: 'button', rect: { x: 0, y: 0, width: 80, height: 32 } },
    status,
    createdAt: '2026-11-24T12:00:00.000Z',
  }
}

describe('note helpers', () => {
  it('converts indices to spreadsheet-style letters starting at A', () => {
    expect(indexToLetter(0)).toBe('A')
    expect(indexToLetter(1)).toBe('B')
    expect(indexToLetter(25)).toBe('Z')
    expect(indexToLetter(26)).toBe('AA')
  })

  it('picks the next unused open letter and resets to A when none are open', () => {
    expect(nextNoteLetter([])).toBe('A')
    expect(nextNoteLetter([makeNote('A')])).toBe('B')
    expect(nextNoteLetter([makeNote('A'), makeNote('C')])).toBe('B')
  })
})

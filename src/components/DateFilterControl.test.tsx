import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import DateFilterControl from './DateFilterControl'

const selectPreset = (value: string) => fireEvent.change(screen.getByRole('combobox'), { target: { value } })

describe('DateFilterControl', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0)) // Friday 9 Oct 2026
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['all', '2000-01-01', '2026-10-09'],
    ['today', '2026-10-09', '2026-10-09'],
    ['7_days', '2026-10-02', '2026-10-09'],
    ['30_days', '2026-09-09', '2026-10-09'],
    ['90_days', '2026-07-11', '2026-10-09'],
    ['this_week', '2026-10-05', '2026-10-09'],
    ['previous_week', '2026-09-28', '2026-10-04'],
    ['this_month', '2026-10-01', '2026-10-09'],
    ['previous_month', '2026-09-01', '2026-09-30'],
    ['this_year', '2026-01-01', '2026-10-09'],
    ['previous_year', '2025-01-01', '2025-12-31'],
  ])('preset %s emits %s to %s', (preset, from, to) => {
    const onChange = vi.fn()
    render(<DateFilterControl onChange={onChange} initialPreset={preset === 'all' ? 'today' : 'all'} />)

    selectPreset(preset)

    expect(onChange).toHaveBeenLastCalledWith({ preset, from, to })
  })

  it('shows date pickers for a custom range and keeps "to" on or after "from"', () => {
    const onChange = vi.fn()
    const { container } = render(<DateFilterControl onChange={onChange} />)

    selectPreset('custom')
    const [fromInput, toInput] = container.querySelectorAll('input[type="date"]')
    fireEvent.change(fromInput, { target: { value: '2026-10-05' } })
    fireEvent.change(toInput, { target: { value: '2026-10-01' } })

    expect(onChange).toHaveBeenLastCalledWith({ preset: 'custom', from: '2026-10-05', to: '2026-10-05' })
  })

  it('offers a Clear Filter button that resets to All Time', () => {
    const onChange = vi.fn()
    render(<DateFilterControl onChange={onChange} />)

    selectPreset('this_month')
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filter' }))

    expect(onChange).toHaveBeenLastCalledWith({ preset: 'all', from: '2000-01-01', to: '2026-10-09' })
  })
})

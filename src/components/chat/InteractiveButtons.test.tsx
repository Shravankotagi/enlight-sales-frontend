import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InteractiveButtons from './InteractiveButtons'

describe('InteractiveButtons', () => {
  it('sends the price save id and cancel for the sales price buttons', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <InteractiveButtons
        buttons={[
          { id: 'btn_price_save', title: 'Save' },
          { id: 'btn_confirm_cancel', title: 'Cancel' },
        ]}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onSelect).toHaveBeenNthCalledWith(1, 'btn_price_save', 'Save')
    expect(onSelect).toHaveBeenNthCalledWith(2, 'cancel', 'Cancel')
  })
})

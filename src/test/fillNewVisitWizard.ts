import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { visitCalendarToday } from '../utils/visitForm';

function visitDialog() {
  return screen.getByRole('dialog', { name: 'Log customer field visit' });
}

export async function fillCompanyAndContact(user: UserEvent) {
  const form = visitDialog();
  await user.type(within(form).getByPlaceholderText('Search or enter company name...'), 'Acme');
  await user.type(within(form).getByPlaceholderText('e.g. Suresh Patel'), 'Ravi');
  await user.type(within(form).getByPlaceholderText('e.g. Purchase Head'), 'Buyer');
  await user.type(within(form).getByPlaceholderText('e.g. 9822012345'), '9822012345');
  await user.type(within(form).getByPlaceholderText('e.g. suresh@company.com'), 'ravi@acme.com');
  await user.type(within(form).getByPlaceholderText('Enter the city'), 'Pune');
  await user.selectOptions(within(form).getByLabelText('Customer Type'), 'OEM');
}

export async function fillVisitDetails(user: UserEvent) {
  await user.click(within(visitDialog()).getByRole('button', { name: 'Hot' }));
}

export async function fillCommercialStep(user: UserEvent) {
  const form = visitDialog();
  await user.type(within(form).getByPlaceholderText('e.g. SS 304 Sheets 2mm, Pipe 4 inch'), 'HR Coil');
  await user.type(within(form).getByPlaceholderText('e.g. 50 MT/month'), '50 MT');
  await user.click(within(form).getByRole('button', { name: /Select brands/i }));
  await user.click(within(form).getByRole('checkbox', { name: 'TATA' }));
  await user.selectOptions(within(form).getByLabelText('Payment Terms'), '30 Days');
  await user.type(within(form).getByPlaceholderText('e.g. Plant 2, Bhosari MIDC'), 'Chakan');
  await user.type(within(form).getByLabelText('Next Purchase Expected'), visitCalendarToday());
  await user.type(within(form).getByPlaceholderText('e.g. Needs 10 MT HR Coil within 4 days'), '10 MT');
}

export async function fillFollowUpStep(user: UserEvent) {
  const form = visitDialog();
  await user.type(within(form).getByLabelText('Follow-up Date'), visitCalendarToday());
  await user.type(within(form).getByPlaceholderText('e.g. Send rate quotation next week'), 'Send quote');
  await user.type(
    within(form).getByPlaceholderText('Details of discussion, products discussed, customer pain points...'),
    'Discussed rates',
  );
}

export async function goToNextVisitStep(user: UserEvent) {
  await user.click(within(visitDialog()).getByRole('button', { name: 'Next' }));
}

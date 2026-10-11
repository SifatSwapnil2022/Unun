import { expect, test } from '@playwright/test';
import { expectHeadline, signInAs, startCheckout, stayLocal } from '../support';

/**
 * One order through every pair of hands: the owner takes it off autopilot, a customer
 * orders, the owner cooks, a rider delivers, the customer reports a problem and support
 * staff refund it. Each person has their own browser, as they would.
 */
test('an order passes from kitchen to rider to customer, and a problem is refunded', async ({
  browser,
}) => {
  const open = async () => {
    const context = await browser.newContext();
    await stayLocal(context);
    return context.newPage();
  };
  const [owner, customer, rider, admin] = await Promise.all([
    open(),
    open(),
    open(),
    open(),
  ]);

  // The owner runs the kitchen by hand.
  await signInAs(owner, 'Rahima');
  await owner.goto('/en/partner');
  const autopilot = owner.getByRole('switch', { name: 'Autopilot' });
  if ((await autopilot.getAttribute('aria-checked')) === 'true') await autopilot.click();
  await expect(autopilot).toHaveAttribute('aria-checked', 'false');

  // A signed-in customer orders.
  await signInAs(customer, 'Rahim');
  await startCheckout(customer, 'dum-ghor', 'Mutton kacchi biryani');
  await customer.getByLabel('Area').selectOption({ label: 'Old Dhaka' });
  await customer
    .getByLabel('Address', { exact: true })
    .fill('House 5, Nazira Bazar Lane');
  await customer.getByRole('button', { name: /^Place order, ৳/ }).click();
  await customer.waitForURL('**/en/orders/**');
  await expectHeadline(customer, 'Your order is with the kitchen');
  const orderId = /UN-[0-9A-Z]{6}/.exec(await customer.locator('main').innerText())![0];

  // The kitchen accepts, cooks and packs it.
  const ticket = owner.locator('.ticket', { hasText: orderId });
  await ticket.getByRole('button', { name: 'Accept' }).click();
  await ticket.getByRole('button', { name: 'Start cooking' }).click();
  await expectHeadline(customer, 'Your food is being cooked');

  // A rider takes it while it cooks.
  await signInAs(rider, 'Jamal');
  await rider.goto('/en/rider');
  // A waiting delivery is listed by its route, not its number. This is the only one.
  await expect(
    rider.getByRole('heading', { name: 'Old Dhaka to Old Dhaka' }),
  ).toBeVisible();
  await rider.getByRole('button', { name: 'Take this delivery' }).click();
  await expect(
    rider.getByText('You can pick it up once the kitchen marks it ready.'),
  ).toBeVisible();

  await ticket.getByRole('button', { name: 'Ready for the rider' }).click();
  await rider.getByRole('button', { name: 'I have picked it up' }).click();
  await expectHeadline(customer, 'The rider is on the way');
  await expect(customer.getByText('Jamal is bringing your order.')).toBeVisible();

  await rider.getByRole('button', { name: 'Delivered, cash collected' }).click();
  await expectHeadline(customer, 'Delivered');
  await expect(customer.getByText('Delivered by Jamal.')).toBeVisible();

  // Something was missing.
  await customer
    .getByRole('button', { name: 'Report a problem with this order' })
    .click();
  await customer.getByRole('radio', { name: 'Something was missing' }).check();
  await customer
    .getByLabel('Tell us what happened')
    .fill(`The borhani for ${orderId} was missing.`);
  await customer.getByRole('button', { name: 'Send report' }).click();
  await expect(customer.getByText('We are looking at it.')).toBeVisible();

  // Support staff give part of the money back.
  await signInAs(admin, 'Nusrat');
  await admin.goto('/en/admin/issues');
  const report = admin
    .getByRole('listitem')
    .filter({ hasText: `for ${orderId} was missing` });
  await report.getByRole('button', { name: 'Give a refund' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Amount in taka').fill('60');
  await dialog
    .getByLabel('Reply to the customer')
    .fill('Sorry. The borhani has been refunded.');
  await dialog.getByRole('button', { name: 'Send the refund' }).click();
  await expect(report).toHaveCount(0);

  // The customer's page shows it without being reloaded.
  await expect(customer.getByText('৳60 has been sent back to you.')).toBeVisible({
    timeout: 40_000,
  });
  await expect(
    customer.getByText('Our reply: Sorry. The borhani has been refunded.'),
  ).toBeVisible();

  // The kitchen is handed back to the simulator for the tests that follow.
  await autopilot.click();
  await expect(autopilot).toHaveAttribute('aria-checked', 'true');
});

test('a workspace is closed to an account with another role', async ({
  page,
  context,
}) => {
  await stayLocal(context);

  await page.goto('/en/admin');
  await page.waitForURL('**/en/sign-in**');

  await signInAs(page, 'Jamal');
  await page.goto('/en/admin');
  await expect(
    page.getByRole('heading', { name: 'This page is for Admin accounts' }),
  ).toBeVisible();
});

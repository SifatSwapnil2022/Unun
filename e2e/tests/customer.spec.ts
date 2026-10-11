import { expect, test } from '@playwright/test';
import {
  chooseArea,
  expectHeadline,
  fillDetails,
  startCheckout,
  stayLocal,
} from '../support';

test.beforeEach(async ({ context }) => {
  await stayLocal(context);
});

test('a visitor orders with cash, watches it arrive and rates it', async ({ page }) => {
  await chooseArea(page, 'Dhanmondi');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dhanmondi');

  await startCheckout(page, 'aloo-bukhara', 'Mutton kacchi biryani');
  await fillDetails(page);

  // The price on the button is the price on the receipt: nothing is added at the end.
  const place = page.getByRole('button', { name: /^Place order, ৳/ });
  await expect(place).toBeEnabled();
  const total = (await place.innerText()).replace('Place order, ', '');
  await expect(page.getByText('You pay').locator('..')).toContainText(total);

  await place.click();
  await page.waitForURL('**/en/orders/**');
  await expect(
    page.getByText(`Have ${total} ready in cash for the rider.`),
  ).toBeVisible();

  await expectHeadline(page, 'Delivered');
  await expect(page.getByText(`Paid to the rider in cash: ${total}.`)).toBeVisible();

  // Only now can it be rated.
  await page.getByRole('radio', { name: '5 stars' }).check({ force: true });
  await page.getByLabel('Anything to add? (optional)').fill('Hot, and early.');
  await page.getByRole('button', { name: 'Send rating' }).click();
  await expect(
    page.getByRole('heading', { name: 'You rated this order 5 of 5.' }),
  ).toBeVisible();

  // The rating is on the kitchen's page, under a first name and one initial.
  await page.goto('/en/kitchens/aloo-bukhara');
  const reviews = page.locator('#reviews');
  await expect(reviews.getByText('Hot, and early.')).toBeVisible();
  await expect(reviews.getByText(/Mitu R\./)).toBeVisible();
  await expect(reviews.getByText('Rahman')).toHaveCount(0);
});

test('an order paid online starts when the payment goes through', async ({ page }) => {
  await chooseArea(page, 'Dhanmondi');
  await startCheckout(page, 'aloo-bukhara', 'Mutton kacchi biryani');
  await fillDetails(page);

  await page.getByRole('radio', { name: /bKash/ }).check();
  await page.getByRole('button', { name: /^Continue to payment, ৳/ }).click();
  await page.waitForURL('**/en/pay/**');

  // The test gateway is this site's own page, and it asks for no PIN or card number.
  await expect(page.getByText('Test payment')).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);

  await page.getByRole('button', { name: 'Decline it' }).click();
  await expect(page.getByRole('heading', { name: 'Payment declined' })).toBeVisible();

  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('button', { name: 'Approve the payment' }).click();
  await page.waitForURL('**/en/orders/**');

  await expect(page.getByText(/^Paid with bKash: ৳/)).toBeVisible();
  // While the order is on its way there is a map with the kitchen and the customer on it.
  const map = page.getByRole('group', { name: 'Map of the delivery' });
  await expect(map).toBeVisible();
  await expect(map.getByText('You', { exact: true })).toBeVisible();

  await expectHeadline(page, 'Delivered');
  await expect(map).toHaveCount(0);
});

test('a dish can be left out by what it contains', async ({ page }) => {
  await page.goto('/en/kitchens/aloo-bukhara');
  const borhani = page.getByRole('heading', { name: 'Borhani', exact: true });
  await expect(borhani).toBeVisible();

  await page.getByText('Hide dishes by allergen').click();
  await page.getByRole('button', { name: 'Milk', exact: true }).click();
  await expect(borhani).toHaveCount(0);
  await expect(
    page.getByText(/hidden here because (it|they) contains? milk/).first(),
  ).toBeVisible();

  // The choice is remembered on the next kitchen's menu.
  await page.goto('/en/kitchens/dum-ghor');
  await expect(page.getByText('Hiding dishes with milk')).toBeVisible();
});

test('the site reads in Bangla', async ({ page }) => {
  await page.goto('/bn/kitchens');
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('রান্নাঘর');
  // Numbers are in Bangla digits too.
  await expect(page.getByText(/৳[০-৯]+/).first()).toBeVisible();
});

test('the phone layout has a tab bar and no sideways scroll @phone', async ({ page }) => {
  await page.goto('/en');
  const tabs = page.getByRole('navigation', { name: 'Quick navigation' });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('link')).toHaveText(['Home', 'Kitchens', 'Bag', 'Sign in']);

  await tabs.getByRole('link', { name: 'Kitchens' }).click();
  await page.waitForURL('**/en/kitchens');
  await expect(tabs.locator('[aria-current="page"]')).toHaveText('Kitchens');

  for (const path of [
    '/en',
    '/en/kitchens',
    '/en/kitchens/dum-ghor',
    '/bn/kitchens/dum-ghor',
  ]) {
    await page.goto(path);
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(sideways, `${path} scrolls sideways`).toBe(false);
  }
});

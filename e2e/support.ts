import { expect, type BrowserContext, type Page } from '@playwright/test';

/** A grey plate, sent in place of every photograph so no test waits on another site. */
const PLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#ddd2c1"/></svg>';

/**
 * Keeps the tests on this machine. Photographs, film and map tiles come from other
 * sites in real use; here each is answered at once with a stand-in, or refused.
 */
export async function stayLocal(context: BrowserContext): Promise<void> {
  await context.route(/^https:\/\/images\.unsplash\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLATE }),
  );
  await context.route(/^https:\/\/tile\.openstreetmap\.org\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLATE }),
  );
  await context.route(/^https:\/\/(assets\.mixkit\.co|videos\.pexels\.com)\//, (route) =>
    route.abort(),
  );
}

/** A mobile number nobody has used yet, so each order is somebody's first. */
export function freshPhone(): string {
  return `0171${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

/** Signs in to one of the demo accounts by its first name, the way a visitor does. */
export async function signInAs(page: Page, firstName: string): Promise<void> {
  await page.goto('/en/sign-in');
  await page
    .getByRole('button', { name: `Sign in as ${firstName}`, exact: true })
    .click();
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'));
}

/** Chooses a delivery area on the home page, as a new visitor would. */
export async function chooseArea(page: Page, area: string): Promise<void> {
  await page.goto('/en');
  await page.getByPlaceholder('Type your area').fill(area);
  await page.getByRole('button', { name: 'Find food' }).click();
  await page.waitForURL('**/en/kitchens');
}

/** Adds one dish from a kitchen's menu and opens the checkout. */
export async function startCheckout(
  page: Page,
  kitchen: string,
  dish: string,
): Promise<void> {
  await page.goto(`/en/kitchens/${kitchen}`);
  await page.getByRole('button', { name: `Add ${dish} to bag` }).click();
  await page.goto('/en/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
}

/** Fills in who the order is for and where it goes. */
export async function fillDetails(page: Page, name = 'Mitu Rahman'): Promise<void> {
  await page.getByLabel('Address', { exact: true }).fill('House 9, Road 4');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Mobile number').fill(freshPhone());
}

/** Waits for the order page's headline to say this. The simulator runs fast in tests. */
export async function expectHeadline(
  page: Page,
  headline: string | RegExp,
): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headline, {
    timeout: 90_000,
  });
}

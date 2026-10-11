import { taka, type Paisa } from '@unun/core';
import { count } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  addresses,
  areas,
  cuisines,
  kitchenCuisines,
  kitchens,
  menuItems,
  menuSections,
  promotions,
  users,
} from '../db/schema';
import { demoAccountSeeds, pastCustomerSeeds } from './accounts';
import { areaSeeds } from './areas';
import { buildMenu, locate } from './build';
import { cuisineSeeds } from './cuisines';
import { seedHistory } from './history';
import { kitchenSeeds } from './kitchens';
import { promotionSeeds } from './promotions';

/**
 * Raise this whenever the seed data changes. On the next start the embedded database is
 * rebuilt from the new data; see db/embedded.ts.
 */
export const SEED_VERSION = 5;

export type SeedOptions = {
  now: Date;
  /**
   * Seed the accounts any visitor may sign in to: an owner, riders and an admin. Only
   * for demo sign-in, where the code is shown on the page.
   */
  demoAccounts: boolean;
  /** Seed four weeks of finished orders and their ratings. Needs the demo accounts. */
  history: boolean;
  serviceFee: Paisa;
  vatRate: number;
};

export type SeedSummary = {
  kitchens: number;
  items: number;
  accounts: number;
  pastOrders: number;
  ratings: number;
};

const CHUNK = 400;

function chunks<T>(rows: T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < rows.length; start += CHUNK) {
    result.push(rows.slice(start, start + CHUNK));
  }
  return result;
}

/** Fills an empty database. Returns null, and changes nothing, if it already has data. */
export async function seedDatabase(
  db: Database,
  options: SeedOptions,
): Promise<SeedSummary | null> {
  const [existing] = await db.select({ total: count() }).from(areas);
  if ((existing?.total ?? 0) > 0) return null;

  return db.transaction(async (tx) => {
    await tx.insert(areas).values(
      areaSeeds.map((area, index) => ({
        id: area.id,
        nameEn: area.en,
        nameBn: area.bn,
        aliases: area.aliases,
        lat: area.lat,
        lng: area.lng,
        sort: index,
      })),
    );

    await tx.insert(cuisines).values(
      cuisineSeeds.map((cuisine, index) => ({
        id: cuisine.id,
        nameEn: cuisine.en,
        nameBn: cuisine.bn,
        tone: cuisine.tone,
        photo: cuisine.photo,
        sort: index,
      })),
    );

    const toneByCuisine = new Map(
      cuisineSeeds.map((cuisine) => [cuisine.id, cuisine.tone]),
    );

    const accountSeeds = options.demoAccounts
      ? [
          ...demoAccountSeeds,
          ...pastCustomerSeeds.map((customer) => ({
            ...customer,
            role: 'customer' as const,
          })),
        ]
      : [];
    const insertedUsers =
      accountSeeds.length === 0
        ? []
        : await tx
            .insert(users)
            .values(
              accountSeeds.map((account, index) => ({
                phone: account.phone,
                name: account.name,
                role: account.role,
                // Spread over the weeks before, so the list of people has an order.
                createdAt: new Date(options.now.getTime() - (index + 8) * 86_400_000),
              })),
            )
            .returning({ id: users.id, phone: users.phone });

    const userIds = new Map(insertedUsers.map((row) => [row.phone, row.id]));
    const ownerOf = new Map(
      demoAccountSeeds.flatMap((account) =>
        (account.kitchens ?? []).map((slug) => [
          slug,
          userIds.get(account.phone) ?? null,
        ]),
      ),
    );

    const savedAddresses = demoAccountSeeds.flatMap((account) => {
      const userId = userIds.get(account.phone);
      return account.address && userId !== undefined
        ? [
            {
              userId,
              label: account.address.label,
              areaId: account.address.area,
              line: account.address.line,
              createdAt: options.now,
            },
          ]
        : [];
    });
    if (savedAddresses.length > 0) await tx.insert(addresses).values(savedAddresses);

    const insertedKitchens = await tx
      .insert(kitchens)
      .values(
        kitchenSeeds.map((kitchen) => ({
          slug: kitchen.slug,
          ownerId: ownerOf.get(kitchen.slug) ?? null,
          nameEn: kitchen.en,
          nameBn: kitchen.bn,
          taglineEn: kitchen.taglineEn,
          taglineBn: kitchen.taglineBn,
          areaId: kitchen.area,
          addressEn: kitchen.addressEn,
          addressBn: kitchen.addressBn,
          ...locate(kitchen),
          prepMinutes: kitchen.prepMinutes,
          minOrder: taka(kitchen.minOrder),
          onTimeOfTen: kitchen.onTimeOfTen,
          opensMinute: kitchen.hours[0],
          closesMinute: kitchen.hours[1],
          tags: kitchen.tags,
          tone: toneByCuisine.get(kitchen.cuisines[0] ?? '') ?? 'ash',
          photo: kitchen.photo,
          profilePhoto: kitchen.profilePhoto,
        })),
      )
      .returning({ id: kitchens.id, slug: kitchens.slug });

    const kitchenIds = new Map(insertedKitchens.map((row) => [row.slug, row.id]));
    const idOf = (slug: string): number => {
      const id = kitchenIds.get(slug);
      if (id === undefined) throw new Error(`Kitchen "${slug}" was not inserted`);
      return id;
    };

    await tx.insert(kitchenCuisines).values(
      kitchenSeeds.flatMap((kitchen) =>
        kitchen.cuisines.map((cuisineId, index) => ({
          kitchenId: idOf(kitchen.slug),
          cuisineId,
          sort: index,
        })),
      ),
    );

    const menus = kitchenSeeds.map((kitchen) => ({
      kitchenId: idOf(kitchen.slug),
      sections: buildMenu(kitchen),
    }));

    const insertedSections = await tx
      .insert(menuSections)
      .values(
        menus.flatMap((menu) =>
          menu.sections.map((section, index) => ({
            kitchenId: menu.kitchenId,
            nameEn: section.en,
            nameBn: section.bn,
            sort: index,
          })),
        ),
      )
      .returning({
        id: menuSections.id,
        kitchenId: menuSections.kitchenId,
        sort: menuSections.sort,
      });

    const sectionIds = new Map(
      insertedSections.map((row) => [`${row.kitchenId}:${row.sort}`, row.id]),
    );

    const itemRows = menus.flatMap((menu) =>
      menu.sections.flatMap((section, sectionIndex) => {
        const sectionId = sectionIds.get(`${menu.kitchenId}:${sectionIndex}`);
        if (sectionId === undefined) throw new Error('A menu section was not inserted');

        return section.items.map((item, index) => ({
          kitchenId: menu.kitchenId,
          sectionId,
          nameEn: item.dish.en,
          nameBn: item.dish.bn,
          descriptionEn: item.dish.descriptionEn,
          descriptionBn: item.dish.descriptionBn,
          price: item.price,
          photo: item.dish.photo,
          tags: item.dish.tags,
          allergens: item.dish.allergens,
          popular: item.popular,
          sort: index,
        }));
      }),
    );

    for (const rows of chunks(itemRows)) {
      await tx.insert(menuItems).values(rows);
    }

    await tx.insert(promotions).values(
      promotionSeeds.map((promotion, index) => ({
        code: promotion.code,
        titleEn: promotion.titleEn,
        titleBn: promotion.titleBn,
        termsEn: promotion.termsEn,
        termsBn: promotion.termsBn,
        kind: promotion.kind,
        value: promotion.kind === 'amount_off' ? taka(promotion.value) : promotion.value,
        maxDiscount: promotion.maxDiscount === null ? null : taka(promotion.maxDiscount),
        minSubtotal: taka(promotion.minSubtotal),
        kitchenId: promotion.kitchen === null ? null : idOf(promotion.kitchen),
        cuisineId: promotion.cuisine,
        startsMinute: promotion.hours?.[0] ?? null,
        endsMinute: promotion.hours?.[1] ?? null,
        firstOrderOnly: promotion.firstOrderOnly,
        paidBy: promotion.paidBy,
        sort: index,
      })),
    );

    const history =
      options.history && options.demoAccounts
        ? await seedHistory(tx, {
            now: options.now,
            serviceFee: options.serviceFee,
            vatRate: options.vatRate,
            riderPhones: demoAccountSeeds
              .filter((account) => account.role === 'rider')
              .map((account) => account.phone),
          })
        : { orders: 0, ratings: 0, issues: 0 };

    return {
      kitchens: kitchenSeeds.length,
      items: itemRows.length,
      accounts: insertedUsers.length,
      pastOrders: history.orders,
      ratings: history.ratings,
    };
  });
}

import { KITCHEN_TAGS, type KitchenTag } from '@unun/core';
import { idParam, oneOf } from '../http/request';
import {
  KITCHEN_SORTS,
  getKitchen,
  listAreas,
  listCuisines,
  listKitchens,
  listOffers,
  type KitchenSort,
} from '../modules/catalogue/service';
import { pairingsFor } from '../modules/ml/suggest';
import type { RouteContext } from './context';

/** A bag is asked about at most this many dishes at a time. */
const MAX_BAG_ITEMS = 40;

export function catalogueRoutes({ app, db, config, ml, now }: RouteContext): void {
  const deps = { config, ml };

  app.get('/v1/areas', async (c) => c.json(await listAreas(db)));

  app.get('/v1/cuisines', async (c) => c.json(await listCuisines(db)));

  app.get('/v1/offers', async (c) => c.json(await listOffers(db)));

  app.get('/v1/kitchens', async (c) => {
    const query = c.req.query();
    const list = await listKitchens(
      db,
      deps,
      {
        areaId: query.area || undefined,
        cuisineId: query.cuisine || undefined,
        query: query.q?.slice(0, 60) || undefined,
        tag: oneOf<KitchenTag>(KITCHEN_TAGS, query.tag),
        sort: oneOf<KitchenSort>(KITCHEN_SORTS, query.sort),
      },
      now(),
    );
    return c.json(list);
  });

  app.get('/v1/kitchens/:slug', async (c) => {
    const kitchen = await getKitchen(
      db,
      deps,
      c.req.param('slug'),
      c.req.query('area') || undefined,
      now(),
    );
    return c.json(kitchen);
  });

  app.get('/v1/kitchens/:slug/pairings', async (c) => {
    const itemIds = (c.req.query('items') ?? '')
      .split(',')
      .filter(Boolean)
      .slice(0, MAX_BAG_ITEMS)
      .map(idParam);
    return c.json(await pairingsFor(db, ml, { slug: c.req.param('slug'), itemIds }));
  });
}

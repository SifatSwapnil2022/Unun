# Goes well with: what the order history gives back

Written by `python -m unun_ml.evaluate`. Do not edit by hand.

## Read this first

The order history is demo data. The seed makes most orders follow ordinary habits
(a borhani with a kacchi, fries with a burger; see `apps/api/src/seed/pairings.ts`)
and leaves the rest to chance. The model is never shown those habits. It is given the
orders and has to find them. So this report shows that it can find a pattern that is
there. On real orders it would find whatever real customers do.

## The test

The model learned from the first 616 orders. For each later order with two
or more dishes, one dish was hidden, and the model was asked what goes with the
rest. It is right when the hidden dish is among its three suggestions.

| Method | Hidden dish found in three suggestions |
| --- | --- |
| Three dishes from the menu at random | 28% |
| The three most ordered dishes on the menu | 47% |
| Dishes ordered together (this model) | 64% |

334 hidden dishes from 155 orders.

## What it learned

| In the bag | It suggests |
| --- | --- |
| Mutton kacchi biryani | Borhani, Jali kabab, Firni |
| Beef burger | Soft drink, 250 ml, Coleslaw, French fries |
| Milk tea | Butter toast, Dal puri, 2 pieces, Toast biscuits |
| Fuchka, 8 pieces | Chotpoti, Lemon sherbet, Tamarind sherbet |

## Kitchens for a customer

The same counts rank kitchens for a signed-in customer: a kitchen scores for cooking
what they have ordered, and what people who order those dishes also order. That
ranking is not measured here. Measuring it needs customers who come back, and the
demo has none.

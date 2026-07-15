# Blackjack Trainer

A personal practice engine for blackjack. It deals real hands from a
depleting 6-deck shoe, offers every legal decision, and after you pick,
reveals — via Monte Carlo simulation against the shoe's actual remaining
composition — which action was really best, along with EV and Win/Push/Loss%
for every option.

## Rules modeled

6 decks, dealer stands on soft 17, blackjack pays 3:2, dealer peeks for
blackjack, double on any first two cards, double after split (DAS) allowed,
split up to 4 hands, split aces get exactly one card each with no further
action (a split-ace + 10 is not a natural), resplitting aces not allowed,
splitting any two 10-value cards is allowed, late surrender allowed only as
the very first action on an original unsplit two-card hand, ~75% penetration
before reshuffle.

## How the simulation works

At each decision point, every legal action (Stand/Hit/Double/Split/Surrender)
is scored by running thousands of Monte Carlo trials against the shoe's
*actual* remaining card composition — not a static infinite-deck table. The
composition already accounts for every card revealed to the player so far
this shoe (their own hands, the dealer's up cards, prior rounds' dealt
cards), and the dealer's hidden hole card is sampled fresh each trial,
conditioned on the peek having already cleared (no dealer blackjack).

Any *further* decisions needed inside a rollout — what to do after this hit,
how to play out a split hand — use a hardcoded 6-deck/S17 basic-strategy
table as the continuation policy, rather than another layer of recursive
simulation. So the displayed EV means "this action now, basic strategy
forever after," which is extremely close to (but not mathematically
identical to) fully optimal recursive EV. See `src/simulation/montecarlo.ts`
for the implementation.

The simulation runs in a Web Worker so the UI never blocks.

## Project layout

```
src/
  engine/         # cards, hand values, rules, the physical shoe, dealer
                   # play, basic strategy table, round state machine
  simulation/      # Monte Carlo core, unknown-pool/peek conditioning,
                    # Web Worker + main-thread client
  ui/                # React components and the useGame state hook
```

## Development

```sh
npm install
npm run dev      # http://localhost:31031
npm test         # vitest: engine unit tests + Monte Carlo sanity checks
npx tsc -b       # typecheck
npm run lint     # oxlint
```

The dev server port is pinned to `31031` in `vite.config.ts`.

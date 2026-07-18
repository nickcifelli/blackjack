# Blackjack Trainer

A personal practice engine for blackjack. It deals hands from a
depleting 6 deck shoe ane offers every legal decision. After you pick,
it reveals the exact combinatorial analysis against the shoe's actual
remaining composition, telling you which action was really best, along with EV and
Win/Push/Loss% for every option.

## Rules modeled

6 decks, dealer stands on soft 17, blackjack pays 3:2, dealer peeks for
blackjack, double on any first two cards, double after split (DAS) allowed,
split up to 4 hands, split aces get exactly one card each with no further
action (a split-ace + 10 is not a natural), resplitting aces not allowed,
splitting any two 10-value cards is allowed, late surrender allowed only as
the very first action on an original unsplit two-card hand, ~75% penetration
before reshuffle.

## How the evaluation works

At each decision point, every legal action (Stand/Hit/Double/Split/Surrender)
is scored via exact combinatorial analysis. It uses deterministic backward
induction / dynamic programming over the shoe's actual remaining card
composition, not a sampled approximation or a static infinite-deck table.
The composition already accounts for every card revealed to the player so
far this shoe (their own hands, the dealer's up cards, prior rounds' dealt
cards), and the dealer's hidden hole card is treated as a probability
distribution conditioned on the peek having already cleared (no dealer
blackjack), rather than sampled.

Every further decision reachable from here, i.e., what to do after this hit,
how to play out a split hand etc., is itself solved exactly (the true optimal
hit/stand/double/split continuation, recursively), not approximated by a
fixed strategy table. Splits follow the standard convention used by every
published combinatorial reference (Wizard of Odds, CVCX, Griffin's *Theory
of Blackjack*): each new hand is solved exactly against the composition
right after the split, independent of what the sibling hand actually draws.
See `src/simulation/combinatorial.ts` for the implementation.

The evaluation runs in a Web Worker so the UI never blocks, though in
practice a full decision resolves in low-single-digit milliseconds.

## Player profiles & stats

Pick a name from the profile switcher in the header (it defaults to
"Guest" on first launch); switching or creating a profile just changes
which localStorage bucket subsequent decisions get recorded into, so a
few people sharing one machine can each keep their own accuracy. It's
plain browser storage scoped to this origin, nothing more: no accounts,
no server, no sync across devices or browsers, and it never touches the
repo.

Beyond the running session accuracy shown in the header, each profile
keeps a full lifetime record, viewable from the profile switcher's
"Advanced Stats" panel: total EV given up versus the optimal play (and
the per-decision average), accuracy broken out by decision type, hand
type (hard/soft/pair), and dealer upcard, a current/best correct-decision
streak, the mix of actions actually chosen, and the ten costliest
individual mistakes ranked by EV lost. See `src/ui/state/profileStore.ts`
for the storage schema and the pure data transforms, and
`src/ui/components/AdvancedStatsModal.tsx` for the panel itself.

## Project layout

```
src/
  engine/         # cards, hand values, rules, the physical shoe, dealer
                   # play, round state machine
  simulation/      # exact combinatorial engine, unknown-pool/peek
                    # conditioning, Web Worker + main-thread client
  ui/                # React components, the useGame state hook, and
                      # localStorage-backed player profiles/stats
```

## Development

```sh
npm install
npm run dev      # http://localhost:31031
npm test         # vitest: engine unit tests + exact-EV reference checks
npx tsc -b       # typecheck
npm run lint     # oxlint
```

The dev server port is pinned to `31031` in `vite.config.ts`.

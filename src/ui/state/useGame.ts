import { useCallback, useEffect, useRef, useState } from 'react';
import { GameRound, bucketsOf } from '../../engine/round';
import { DEFAULT_RULES, type RuleConfig } from '../../engine/rules';
import { bucketOf } from '../../engine/cards';
import type { Action } from '../../engine/actions';
import { SimulationClient } from '../../simulation/workerClient';
import { pickBestAction, type DecisionResults } from '../../simulation/combinatorial';

export interface DecisionFeedback {
  action: Action;
  results: DecisionResults;
  bestAction: Action;
  correct: boolean;
}

function useForceUpdate() {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((t) => t + 1), []);
}

/** Real-time gap between the dealer's hole card flip and each subsequent hit, so the reveal doesn't snap in instantly. */
const DEALER_REVEAL_INTERVAL_MS = 900;

export function useGame(rules: RuleConfig = DEFAULT_RULES, onDecision?: (correct: boolean) => void) {
  const roundRef = useRef<GameRound | null>(null);
  const simRef = useRef<SimulationClient | null>(null);
  const evalTokenRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceUpdate = useForceUpdate();

  const [pendingResults, setPendingResults] = useState<DecisionResults | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<DecisionFeedback | null>(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  // How many of the dealer's cards are currently shown; ramped up one at a time during resolution
  // instead of jumping straight to the final hand, so the hole-card flip and any dealer hits read
  // as a sequence rather than popping in all at once.
  const [dealerRevealCount, setDealerRevealCount] = useState(1);

  if (!roundRef.current) roundRef.current = new GameRound(rules);
  const round = roundRef.current;

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const revealDealerCardsProgressively = useCallback(
    (from: number, to: number) => {
      clearRevealTimer();
      setDealerRevealCount(from);
      const tick = (count: number) => {
        if (count >= to) return;
        revealTimerRef.current = setTimeout(() => {
          setDealerRevealCount(count + 1);
          tick(count + 1);
        }, DEALER_REVEAL_INTERVAL_MS);
      };
      tick(from);
    },
    [clearRevealTimer],
  );

  const startEvaluationForCurrentDecision = useCallback(() => {
    const sim = simRef.current;
    if (!sim || round.phase !== 'player-turn') {
      setPendingResults(null);
      return;
    }
    const legalActions = round.legalActions();
    if (legalActions.length === 0) {
      setPendingResults(null);
      return;
    }
    const hand = round.hands[round.activeHandIndex];
    const token = ++evalTokenRef.current;
    setEvaluating(true);
    setPendingResults(null);
    sim
      .evaluate({
        legalActions,
        playerCards: bucketsOf(hand),
        dealerUp: bucketOf(round.dealerUpCard.rank),
        unknownComposition: round.shoe.unknownComposition(),
        rules: round.rules,
      })
      .then((results) => {
        if (evalTokenRef.current !== token) return; // a newer decision superseded this one
        setPendingResults(results);
        setEvaluating(false);
      });
  }, [round]);

  // The worker is created (and torn down) here rather than in the render
  // body: React Strict Mode's dev-only mount->cleanup->mount double-invoke of
  // effects would otherwise terminate the very first worker instance right
  // after creation, leaving the initial evaluation's promise unresolved
  // forever. Creating it inside the effect means the second (surviving)
  // mount produces the worker that's actually used; evalTokenRef already
  // discards any stale response from the first, torn-down instance.
  useEffect(() => {
    const client = new SimulationClient();
    simRef.current = client;
    startEvaluationForCurrentDecision();
    if (round.phase === 'round-over' && round.dealerCards.length > 1) {
      revealDealerCardsProgressively(1, round.dealerCards.length);
    }
    return () => {
      client.terminate();
      simRef.current = null;
      clearRevealTimer();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared by every action that leaves the round mid-transition (dealing a new hand, reshuffling,
  // or changing a rule): clears stale feedback, re-syncs the dealer reveal animation to the round's
  // new phase, and kicks off evaluation of whatever decision (if any) now needs one.
  const syncAfterRoundChange = useCallback(() => {
    setFeedback(null);
    if (round.phase === 'round-over') {
      revealDealerCardsProgressively(1, round.dealerCards.length);
    } else {
      clearRevealTimer();
      setDealerRevealCount(1);
    }
    forceUpdate();
    startEvaluationForCurrentDecision();
  }, [round, forceUpdate, startEvaluationForCurrentDecision, revealDealerCardsProgressively, clearRevealTimer]);

  const dealNext = useCallback(() => {
    round.deal();
    syncAfterRoundChange();
  }, [round, syncAfterRoundChange]);

  const newShoe = useCallback(() => {
    round.newShoe();
    syncAfterRoundChange();
  }, [round, syncAfterRoundChange]);

  const setDealerStandsSoft17 = useCallback(
    (standsSoft17: boolean) => {
      round.setDealerStandsSoft17(standsSoft17);
      syncAfterRoundChange();
    },
    [round, syncAfterRoundChange],
  );

  const setDasAllowed = useCallback(
    (dasAllowed: boolean) => {
      round.setDasAllowed(dasAllowed);
      syncAfterRoundChange();
    },
    [round, syncAfterRoundChange],
  );

  const setLateSurrenderAllowed = useCallback(
    (lateSurrenderAllowed: boolean) => {
      round.setLateSurrenderAllowed(lateSurrenderAllowed);
      syncAfterRoundChange();
    },
    [round, syncAfterRoundChange],
  );

  const choose = useCallback(
    (action: Action) => {
      if (!pendingResults) return;
      const bestAction = pickBestAction(pendingResults);
      const correct = action === bestAction;
      setFeedback({ action, results: pendingResults, bestAction, correct });
      setSessionStats((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
      onDecision?.(correct);

      round.applyAction(action);
      forceUpdate();

      if (round.phase === 'player-turn') {
        startEvaluationForCurrentDecision();
      } else {
        setPendingResults(null);
        revealDealerCardsProgressively(1, round.dealerCards.length);
      }
    },
    [round, pendingResults, forceUpdate, startEvaluationForCurrentDecision, revealDealerCardsProgressively, onDecision],
  );

  const dealerCardsVisible = round.dealerCards.slice(0, dealerRevealCount);
  const revealComplete = dealerRevealCount >= round.dealerCards.length;

  return {
    phase: round.phase,
    dealerCards: dealerCardsVisible,
    dealerHoleRevealed: dealerRevealCount > 1,
    hands: round.hands,
    activeHandIndex: round.activeHandIndex,
    legalActions: round.phase === 'player-turn' ? round.legalActions() : [],
    summary: round.phase === 'round-over' && revealComplete ? round.summary : null,
    canDealNext: round.phase === 'round-over' && revealComplete,
    shoeRemaining: round.shoe.remainingCount(),
    shoeTotal: round.shoe.totalSize(),
    cardsUntilCutCard: round.shoe.cardsUntilCutCard(),
    evaluating,
    canChoose: pendingResults !== null,
    feedback,
    sessionStats,
    dealerStandsSoft17: round.rules.dealerStandsSoft17,
    dasAllowed: round.rules.dasAllowed,
    lateSurrenderAllowed: round.rules.lateSurrenderAllowed,
    choose,
    dealNext,
    newShoe,
    setDealerStandsSoft17,
    setDasAllowed,
    setLateSurrenderAllowed,
  };
}

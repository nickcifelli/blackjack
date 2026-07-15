import { useCallback, useEffect, useRef, useState } from 'react';
import { GameRound, bucketsOf } from '../../engine/round';
import { DEFAULT_RULES, type RuleConfig } from '../../engine/rules';
import { bucketOf } from '../../engine/cards';
import type { Action } from '../../engine/actions';
import { SimulationClient } from '../../simulation/workerClient';
import { pickBestAction, type DecisionResults } from '../../simulation/montecarlo';

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

export function useGame(rules: RuleConfig = DEFAULT_RULES) {
  const roundRef = useRef<GameRound | null>(null);
  const simRef = useRef<SimulationClient | null>(null);
  const evalTokenRef = useRef(0);
  const forceUpdate = useForceUpdate();

  const [pendingResults, setPendingResults] = useState<DecisionResults | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<DecisionFeedback | null>(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

  if (!roundRef.current) roundRef.current = new GameRound(rules);
  const round = roundRef.current;

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
    return () => {
      client.terminate();
      simRef.current = null;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dealNext = useCallback(() => {
    round.deal();
    setFeedback(null);
    forceUpdate();
    startEvaluationForCurrentDecision();
  }, [round, forceUpdate, startEvaluationForCurrentDecision]);

  const newShoe = useCallback(() => {
    round.newShoe();
    setFeedback(null);
    forceUpdate();
    startEvaluationForCurrentDecision();
  }, [round, forceUpdate, startEvaluationForCurrentDecision]);

  const choose = useCallback(
    (action: Action) => {
      if (!pendingResults) return;
      const bestAction = pickBestAction(pendingResults);
      setFeedback({ action, results: pendingResults, bestAction, correct: action === bestAction });
      setSessionStats((s) => ({ correct: s.correct + (action === bestAction ? 1 : 0), total: s.total + 1 }));

      round.applyAction(action);
      forceUpdate();

      if (round.phase === 'player-turn') {
        startEvaluationForCurrentDecision();
      } else {
        setPendingResults(null);
      }
    },
    [round, pendingResults, forceUpdate, startEvaluationForCurrentDecision],
  );

  return {
    phase: round.phase,
    dealerCards: round.dealerCards,
    dealerHoleRevealed: round.dealerCards.length > 1,
    hands: round.hands,
    activeHandIndex: round.activeHandIndex,
    legalActions: round.phase === 'player-turn' ? round.legalActions() : [],
    summary: round.summary,
    shoeRemaining: round.shoe.remainingCount(),
    shoeTotal: round.shoe.totalSize(),
    evaluating,
    canChoose: pendingResults !== null,
    feedback,
    sessionStats,
    choose,
    dealNext,
    newShoe,
  };
}

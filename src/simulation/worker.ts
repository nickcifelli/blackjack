/// <reference lib="webworker" />
import { evaluateDecision, type EvaluateDecisionRequest, type DecisionResults } from './montecarlo';

export interface WorkerRequestMessage {
  id: number;
  request: EvaluateDecisionRequest;
}

export interface WorkerResponseMessage {
  id: number;
  results: DecisionResults;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
  const { id, request } = event.data;
  const results = evaluateDecision(request);
  const response: WorkerResponseMessage = { id, results };
  ctx.postMessage(response);
};

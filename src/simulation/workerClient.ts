import type { EvaluateDecisionRequest, DecisionResults } from './combinatorial';
import type { WorkerRequestMessage, WorkerResponseMessage } from './worker';

/** Promise-based wrapper around the simulation Web Worker. */
export class SimulationClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, (results: DecisionResults) => void>();

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
      const { id, results } = event.data;
      const resolve = this.pending.get(id);
      if (resolve) {
        this.pending.delete(id);
        resolve(results);
      }
    };
  }

  evaluate(request: EvaluateDecisionRequest): Promise<DecisionResults> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      const message: WorkerRequestMessage = { id, request };
      this.worker.postMessage(message);
    });
  }

  terminate(): void {
    this.worker.terminate();
  }
}

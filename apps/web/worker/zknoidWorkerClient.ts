import { fetchAccount, Field, Bool, UInt64 } from 'o1js';

import type {
  ZknoidWorkerRequest,
  ZknoidWorkerReponse,
  WorkerFunctions,
} from './zknoidWorker';
import { Bricks, GameInputs, checkGameRecord } from 'zknoid-chain-dev';
import { GameRecordProof } from 'zknoid-chain-dev';

export default class ZknoidWorkerClient {
  loadContracts() {
    return this._call('loadContracts', {});
  }
  loadLotteryContract() {
    return this._call('loadLotteryContract', {});
  }
  compileContracts() {
    return this._call('compileContracts', {});
  }
  downloadLotteryCache() {
    return this._call('downloadLotteryCache', {});
  }
  compileLotteryContracts() {
    return this._call('compileLotteryContracts', {});
  }
  compileDistributionProof() {
    return this._call('compileDistributionProof', {});
  }
  initZkappInstance(bridgePublicKey58: string) {
    return this._call('initZkappInstance', { bridgePublicKey58 });
  }
  initLotteryInstance(lotteryPublicKey58: string, networkId: string) {
    return this._call('initLotteryInstance', { lotteryPublicKey58, networkId });
  }
  buyTicket(
    senderAccount: string,
    startBlock: number,
    roundId: number,
    ticketNums: number[],
    amount: number,
  ) {
    return this._call('buyTicket', {
      senderAccount,
      startBlock,
      roundId,
      ticketNums,
      amount
    });
  }
  fetchOffchainState(startBlock: number, roundId: number): Promise<number> {
    return this._call('fetchOffchainState', {    
      startBlock,
      roundId
  }) as Promise<number>;
  }
  getRoundsInfo(roundIds: number[]) {
    return this._call('getRoundsInfo', {roundIds})
  }
  getLotteryState() {
    return this._call('getLotteryState', {});
  }
  bridge(amount: UInt64) {
    return this._call('bridge', { amount });
  }
  async proveGameRecord({
    seed,
    inputs,
    debug,
  }: {
    seed: Field;
    inputs: GameInputs[];
    debug: Bool;
  }) {
    const result = await this._call('proveGameRecord', {
      seedJson: seed.toJSON(),
      inputs: JSON.stringify(inputs.map((elem) => GameInputs.toJSON(elem))),
      debug: Bool.toJSON(debug),
    });
    console.log('Restoring', result);
    const restoredProof = GameRecordProof.fromJSON(result);

    return restoredProof;
  }

  worker: Worker;

  promises: {
    [id: number]: { resolve: (res: any) => void; reject: (err: any) => void };
  };

  nextId: number;

  readyPromise: Promise<void>;

  constructor() {
    this.promises = {};

    this.worker = new Worker(new URL('./zknoidWorker.ts', import.meta.url));
    (window as any).workerNoid = this.worker;
    this.readyPromise = new Promise((resolve, reject) => {
      this.promises[0] = { resolve, reject };
    });

    this.nextId = 1;

    this.worker.onmessage = (event: MessageEvent<ZknoidWorkerReponse>) => {
      this.promises[event.data.id].resolve(event.data.data);
      delete this.promises[event.data.id];
    };
  }

  async waitFor(): Promise<void> {
    await this.readyPromise;
  }

  _call(fn: WorkerFunctions, args: any) {
    return new Promise((resolve, reject) => {
      this.promises[this.nextId] = { resolve, reject };

      const message: ZknoidWorkerRequest = {
        id: this.nextId,
        fn,
        args,
      };

      this.worker.postMessage(message);

      this.nextId++;
    });
  }
}

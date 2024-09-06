import { UInt64 } from '@proto-kit/library';
import { ArkanoidGameHub } from './arkanoid/ArkanoidGameHub';
import { RandzuLogic } from './randzu/RandzuLogic';
import { ThimblerigLogic } from './thimblerig/ThimblerigLogic';
import { Balances } from './framework';
import { ModulesConfig } from '@proto-kit/common';
import { CheckersLogic } from './checkers';
import { GuessGame } from './number_guessing';
import { SlotMachine } from './TokenTwist';
import { PiratesLogic } from './pirates';

const modules = {
  Balances,
  PiratesLogic
};

const config: ModulesConfig<typeof modules> = {
  Balances: {
    totalSupply: UInt64.from(10000),
  },
  // GuessGame: {},
  // SlotMachine: {},
  PiratesLogic:{}
};

export default {
  modules,
  config,
};

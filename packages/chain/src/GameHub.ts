import {
    RuntimeModule,
    runtimeModule,
    state,
    runtimeMethod,
} from '@proto-kit/module';
import { State, StateMap, assert } from '@proto-kit/protocol';
import {
    Experimental,
    PublicKey,
    Field,
    UInt64,
    Struct,
    arrayProp,
    MerkleMap,
    CircuitString,
    Provable,
} from 'o1js';

export class GameRecordKey extends Struct({
    seed: UInt64,
    player: PublicKey,
}) {}

export class Point extends Struct({
    x: UInt64,
    y: UInt64,
}) {}

export class GameCell extends Struct({
    value: UInt64, // Indicated lifes of the cell
}) {}

export const FIELD_SIZE = 18;

export class GameField extends Struct({
    cells: Provable.Array(GameCell, FIELD_SIZE),
}) {}

export const GAME_LENGTH = 1000;

export class Tick extends Struct({
    action: UInt64,
}) {}

export class GameInputs extends Struct({
    tiks: Provable.Array(Tick, GAME_LENGTH),
}) {}

class MapGenerationPublicOutput extends Struct({}) {}

export function checkMapGeneration(
    seed: Field,
    gameField: GameField
): MapGenerationPublicOutput {
    return new MapGenerationPublicOutput({});
}

export const mapGeneration = Experimental.ZkProgram({
    publicOutput: MapGenerationPublicOutput,
    methods: {
        checkGameRecord: {
            privateInputs: [Field, GameField],
            method: checkMapGeneration,
        },
    },
});

export class MapGenerationProof extends Experimental.ZkProgram.Proof(
    mapGeneration
) {}

export class GameRecordPublicOutput extends Struct({
    score: UInt64,
}) {}

export function checkGameRecord(
    gameField: GameField,
    gameInputs: GameInputs
): GameRecordPublicOutput {
    // ignoredPI: Field
    // #TODO write game logic

    let score = UInt64.from(0);

    /// Just for testing purposed 01210 will give you 666 points
    const cheatCodeScore = UInt64.from(666);

    const cheatCodeActivated = gameInputs.tiks[0].action
        .equals(UInt64.from(0))
        .and(gameInputs.tiks[1].action.equals(UInt64.from(1)))
        .and(gameInputs.tiks[2].action.equals(UInt64.from(2)))
        .and(gameInputs.tiks[3].action.equals(UInt64.from(1)))
        .and(gameInputs.tiks[4].action.equals(UInt64.from(0)));

    score = Provable.if(cheatCodeActivated, cheatCodeScore, UInt64.from(0));

    return new GameRecordPublicOutput({ score });
}

export const gameRecord = Experimental.ZkProgram({
    // publicInput: Field,
    publicOutput: GameRecordPublicOutput,
    methods: {
        checkGameRecord: {
            // privateInputs: [],
            privateInputs: [GameField, GameInputs],
            method: checkGameRecord,
        },
    },
});

export class GameRecordProof extends Experimental.ZkProgram.Proof(gameRecord) {}

@runtimeModule()
export class GameHub extends RuntimeModule<unknown> {
    /// Seed + User => Record
    @state() public gameRecords = StateMap.from<GameRecordKey, UInt64>(
        GameRecordKey,
        UInt64
    );
    @state() public seeds = StateMap.from<UInt64, UInt64>(UInt64, UInt64);
    @state() public lastSeed = State.from<UInt64>(UInt64);
    @state() public lastUpdate = State.from<UInt64>(UInt64);

    @runtimeMethod()
    public updateSeed(seed: UInt64): void {
        const lastSeedIndex = this.lastSeed.get().orElse(UInt64.from(0));
        this.seeds.set(lastSeedIndex, seed);
        this.lastSeed.set(lastSeedIndex.add(1));
    }

    @runtimeMethod()
    /// Check for user public key
    public addGameResult(
        account: PublicKey,
        gameRecordProof: GameRecordProof
    ): void {
        gameRecordProof.verify();

        const gameKey = new GameRecordKey({
            seed: this.seeds.get(this.lastSeed.get().value).value,
            player: account,
        });

        const currentScore = this.gameRecords.get(gameKey).value;
        const newScore = gameRecordProof.publicOutput.score;

        if (currentScore < newScore) {
            this.gameRecords.set(gameKey, newScore);
        }
    }
}

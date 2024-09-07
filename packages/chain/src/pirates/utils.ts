import { UInt64 } from '@proto-kit/library';
import { Int64, Provable } from 'o1js';
import { DECIMALS, QUANISATION_LEVEL } from './constants';

/**
 * x = [0, 72] 0 = 0 degree, 72 = 360 degree
 */
function sin0to90(x: UInt64) {
  let res = UInt64.zero;
  for (let i = 1; i <= QUANISATION_LEVEL / 4; i++) {
    res = new UInt64(
      Provable.if(
        x.equals(UInt64.from(i)),
        UInt64,
        UInt64.from(
          Math.round(
            Math.sin((i * 2 * Math.PI) / QUANISATION_LEVEL) * 10 ** DECIMALS,
          ),
        ),
        res,
      ),
    );
  }
  return res;
}

function safeSub(x: UInt64, y: UInt64): UInt64 {
  const adjestedY = Provable.if(x.greaterThan(y), UInt64, y, x);
  return x.sub(new UInt64(adjestedY));
}

/**
 * @param rest in range [0, 72]
 * @returns value of sin(x) * 10^DECIMALS
 */
export function sin(x: UInt64): Int64 {
  const { quotient, rest } = x.divMod(QUANISATION_LEVEL);
  const xAdjusted = new UInt64(
    Provable.if(
      rest.lessThanOrEqual(UInt64.from(QUANISATION_LEVEL / 2)),
      UInt64,
      // x = [0, 36]
      Provable.if(
        rest.lessThanOrEqual(UInt64.from(QUANISATION_LEVEL / 4)),
        UInt64,
        // x = [0, 18]
        rest,
        // x = (18, 36]
        safeSub(UInt64.from(QUANISATION_LEVEL / 2), rest),
      ),
      // x = (36, 72]
      Provable.if(
        rest.lessThanOrEqual(UInt64.from((3 * QUANISATION_LEVEL) / 4)),
        UInt64,
        // x = (36, 54]
        safeSub(rest, UInt64.from(QUANISATION_LEVEL / 2)),
        // x = (54, 72]
        safeSub(UInt64.from(QUANISATION_LEVEL), rest),
      ),
    ),
  );
  // Provable.asProver(() => {
  //   console.log("xAdjusted", xAdjusted.toString());
  // });

  return Provable.if(
    rest.lessThanOrEqual(UInt64.from(QUANISATION_LEVEL / 2)),
    Int64.from(sin0to90(xAdjusted).toO1UInt64()),
    Int64.from(sin0to90(xAdjusted).toO1UInt64()).mul(-1),
  );
}

/**
 * @param x in range [0, 72]
 * @returns value of cos(x) * 10^DECIMALS
 */
export function cos(x: UInt64): Int64 {
  return sin(x.add(UInt64.from(QUANISATION_LEVEL / 4)));
}

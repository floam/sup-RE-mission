import { CurrencyAmount, Token } from "@uniswap/sdk-core";
import {
  nearestUsableTick,
  Pool,
  Position,
  TickMath,
  TICK_SPACINGS,
} from "@uniswap/v3-sdk";

export type LiquidityInputToken = "eth" | "sup";

function fullRangeTicks(fee: keyof typeof TICK_SPACINGS) {
  const spacing = TICK_SPACINGS[fee];
  return {
    tickLower: nearestUsableTick(TickMath.MIN_TICK, spacing),
    tickUpper: nearestUsableTick(TickMath.MAX_TICK, spacing),
  };
}

/** Full-range counterpart calculation recovered from webpack 21246. */
export function calculateCorrespondingLiquidityAmount(input: {
  pool: Pool;
  sdkToken0: Token;
  sdkToken1: Token;
  isSUPToken0: boolean;
  inputAmount: bigint;
  inputToken: LiquidityInputToken;
}): { amount: bigint; token: LiquidityInputToken } {
  const { tickLower, tickUpper } = fullRangeTicks(
    input.pool.fee as keyof typeof TICK_SPACINGS,
  );
  let position: Position;
  if (input.inputToken === "eth") {
    if (input.isSUPToken0) {
      const amount = CurrencyAmount.fromRawAmount(
        input.sdkToken1,
        input.inputAmount.toString(),
      );
      position = Position.fromAmount1({
        pool: input.pool,
        tickLower,
        tickUpper,
        amount1: amount.quotient,
      });
      return {
        amount: BigInt(position.amount0.quotient.toString()),
        token: "sup",
      };
    }
    const amount = CurrencyAmount.fromRawAmount(
      input.sdkToken0,
      input.inputAmount.toString(),
    );
    position = Position.fromAmount0({
      pool: input.pool,
      tickLower,
      tickUpper,
      amount0: amount.quotient,
      useFullPrecision: true,
    });
    return {
      amount: BigInt(position.amount1.quotient.toString()),
      token: "sup",
    };
  }
  if (input.isSUPToken0) {
    const amount = CurrencyAmount.fromRawAmount(
      input.sdkToken0,
      input.inputAmount.toString(),
    );
    position = Position.fromAmount0({
      pool: input.pool,
      tickLower,
      tickUpper,
      amount0: amount.quotient,
      useFullPrecision: true,
    });
    return {
      amount: BigInt(position.amount1.quotient.toString()),
      token: "eth",
    };
  }
  const amount = CurrencyAmount.fromRawAmount(
    input.sdkToken1,
    input.inputAmount.toString(),
  );
  position = Position.fromAmount1({
    pool: input.pool,
    tickLower,
    tickUpper,
    amount1: amount.quotient,
  });
  return { amount: BigInt(position.amount0.quotient.toString()), token: "eth" };
}

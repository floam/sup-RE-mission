import { formatTokenAmount, inferDecimalPlaces } from "../lib/format";

export interface FormattedBalanceProps {
  balance: bigint;
  decimalPlaces?: number;
  className?: string;
  dataTestId?: string;
}

export function FormattedBalance({
  balance,
  decimalPlaces = inferDecimalPlaces(balance),
  className,
  dataTestId,
}: FormattedBalanceProps) {
  return (
    <span className={className} data-testid={dataTestId}>
      {formatTokenAmount(balance, decimalPlaces)}
    </span>
  );
}

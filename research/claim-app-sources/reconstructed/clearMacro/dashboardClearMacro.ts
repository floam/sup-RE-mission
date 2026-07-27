import { parseAbi, stringToHex, type Address } from "viem";

export const CLEAR_MACRO_LANG = stringToHex("en", { size: 32 });

export const dashboardClearMacroAbi = parseAbi([
  "function encodeApprove(bytes32 lang,(address superToken,address spender,uint256 amount) p) view returns (bytes)",
  "function describeApprove(bytes32 lang,(address superToken,address spender,uint256 amount) p) view returns (string)",
  "function encodeTransfer(bytes32 lang,(address superToken,address receiver,uint256 amount) p) view returns (bytes)",
  "function describeTransfer(bytes32 lang,(address superToken,address receiver,uint256 amount) p) view returns (string)",
  "function encodeUpgrade(bytes32 lang,(address superToken,uint256 amount) p) view returns (bytes)",
  "function describeUpgrade(bytes32 lang,(address superToken,uint256 amount) p) view returns (string)",
  "function encodeDowngrade(bytes32 lang,(address superToken,uint256 amount) p) view returns (bytes)",
  "function describeDowngrade(bytes32 lang,(address superToken,uint256 amount) p) view returns (string)",
  "function encodeCreateFlow(bytes32 lang,(address superToken,address receiver,int96 flowRate) p) view returns (bytes)",
  "function describeCreateFlow(bytes32 lang,(address superToken,address receiver,int96 flowRate) p) view returns (string)",
  "function encodeUpdateFlow(bytes32 lang,(address superToken,address receiver,int96 flowRate) p) view returns (bytes)",
  "function describeUpdateFlow(bytes32 lang,(address superToken,address receiver,int96 flowRate) p) view returns (string)",
  "function encodeDeleteFlow(bytes32 lang,(address superToken,address sender,address receiver) p) view returns (bytes)",
  "function describeDeleteFlow(bytes32 lang,(address superToken,address sender,address receiver) p) view returns (string)",
  "function encodeScheduleFlow(bytes32 lang,(address superToken,address receiver,uint32 startDate,int96 flowRate,uint32 endDate) p) view returns (bytes)",
  "function describeScheduleFlow(bytes32 lang,(address superToken,address receiver,uint32 startDate,int96 flowRate,uint32 endDate) p) view returns (string)",
  "function encodeDeleteFlowSchedule(bytes32 lang,(address superToken,address receiver) p) view returns (bytes)",
  "function describeDeleteFlowSchedule(bytes32 lang,(address superToken,address receiver) p) view returns (string)",
  "function getPrimaryTypeName(bytes encodedParams) view returns (string)",
  "function previewRelayFee(bytes actionParams,address account) view returns (address feeToken,address feeReceiver,uint256 currentFee,uint256 maxFee)",
]);

export type ClearMacroAction =
  | { kind: "approve"; superToken: Address; spender: Address; amount: bigint }
  | { kind: "transfer"; superToken: Address; receiver: Address; amount: bigint }
  | { kind: "upgrade"; superToken: Address; amount: bigint }
  | { kind: "downgrade"; superToken: Address; amount: bigint }
  | { kind: "createFlow"; superToken: Address; receiver: Address; flowRate: bigint }
  | { kind: "updateFlow"; superToken: Address; receiver: Address; flowRate: bigint }
  | { kind: "deleteFlow"; superToken: Address; sender: Address; receiver: Address }
  | {
      kind: "scheduleFlow";
      superToken: Address;
      receiver: Address;
      startDate: number;
      flowRate: bigint;
      endDate: number;
    }
  | { kind: "deleteFlowSchedule"; superToken: Address; receiver: Address };

export function getActionCallInfo(action: ClearMacroAction): {
  encodeFunctionName: string;
  describeFunctionName: string;
  tuple: Record<string, unknown>;
} {
  switch (action.kind) {
    case "approve":
      return { encodeFunctionName: "encodeApprove", describeFunctionName: "describeApprove", tuple: action };
    case "transfer":
      return { encodeFunctionName: "encodeTransfer", describeFunctionName: "describeTransfer", tuple: action };
    case "upgrade":
      return { encodeFunctionName: "encodeUpgrade", describeFunctionName: "describeUpgrade", tuple: action };
    case "downgrade":
      return { encodeFunctionName: "encodeDowngrade", describeFunctionName: "describeDowngrade", tuple: action };
    case "createFlow":
      return { encodeFunctionName: "encodeCreateFlow", describeFunctionName: "describeCreateFlow", tuple: action };
    case "updateFlow":
      return { encodeFunctionName: "encodeUpdateFlow", describeFunctionName: "describeUpdateFlow", tuple: action };
    case "deleteFlow":
      return { encodeFunctionName: "encodeDeleteFlow", describeFunctionName: "describeDeleteFlow", tuple: action };
    case "scheduleFlow":
      return { encodeFunctionName: "encodeScheduleFlow", describeFunctionName: "describeScheduleFlow", tuple: action };
    case "deleteFlowSchedule":
      return { encodeFunctionName: "encodeDeleteFlowSchedule", describeFunctionName: "describeDeleteFlowSchedule", tuple: action };
  }
}

export function resolveActionFieldValue(
  action: ClearMacroAction,
  description: string,
  fieldName: string,
): unknown | undefined {
  if (fieldName === "description") return description;
  if (fieldName === "token") return action.superToken;
  if (fieldName === "kind") return undefined;
  return (action as unknown as Record<string, unknown>)[fieldName];
}

export function parseEIP712TypeDef(typeDef: string) {
  const types: Record<string, { type: string; name: string }[]> = {};
  const pattern = /([A-Z]\w*)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(typeDef)) !== null) {
    const [, typeName, fields] = match;
    types[typeName] = fields
      ? fields.split(",").map((field) => {
          const [type, name] = field.trim().split(/\s+/);
          return { type, name };
        })
      : [];
  }
  return types;
}

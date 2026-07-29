"use client";

import { useCallback, useMemo } from "react";
import { encodeFunctionData, namehash, parseEther } from "viem";
import {
  useEstimateGas,
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { BASE_CHAIN_ID } from "../config/chains";
import { APP_CHAIN } from "../config/chains";
import {
  RESERVE_NAME_REGISTRAR_ADDRESS,
  reserveNameRegistrarAbi,
} from "../contracts/app-contracts";
import type { Address } from "../types/program-app";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";

const EMPTY_NODE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function getReserveNameFee(subdomain: string) {
  if (!subdomain) return 0n;
  if (subdomain.length === 1) return parseEther("0.1");
  if (subdomain.length === 2) return parseEther("0.01");
  if (subdomain.length === 3) return parseEther("0.001");
  return parseEther("0.0001");
}

export function validateReserveSubdomain(subdomain: string) {
  if (!subdomain)
    return { isValid: false, error: "Subdomain cannot be empty" } as const;
  if (subdomain.length < 1)
    return {
      isValid: false,
      error: "Subdomain must be at least 1 character",
    } as const;
  if (subdomain.length > 63)
    return {
      isValid: false,
      error: "Subdomain must be less than 63 characters",
    } as const;
  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return {
      isValid: false,
      error: "Only lowercase letters, numbers, and hyphens allowed",
    } as const;
  }
  if (subdomain.startsWith("-") || subdomain.endsWith("-")) {
    return {
      isValid: false,
      error: "Cannot start or end with a hyphen",
    } as const;
  }
  return { isValid: true } as const;
}

export function useReserveNameRegistration({
  accountAddress,
  subdomain,
}: {
  accountAddress?: Address;
  subdomain: string;
}) {
  const registrarAddress =
    APP_CHAIN.id === BASE_CHAIN_ID
      ? RESERVE_NAME_REGISTRAR_ADDRESS[BASE_CHAIN_ID]
      : undefined;
  const readDomainName = useReadContract({
    address: registrarAddress,
    abi: reserveNameRegistrarAbi,
    functionName: "domainName",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(registrarAddress) },
  });
  const readUserSubdomain = useReadContract({
    address: registrarAddress,
    abi: reserveNameRegistrarAbi,
    functionName: "getUserSubdomain",
    args: accountAddress ? [accountAddress] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(registrarAddress && accountAddress) },
  });
  const userSubdomainNode = readUserSubdomain.data;
  const hasExistingSubdomain = Boolean(
    userSubdomainNode &&
    userSubdomainNode !== EMPTY_NODE &&
    userSubdomainNode !== "0x00",
  );
  const readUserSubdomainName = useReadContract({
    address: registrarAddress,
    abi: reserveNameRegistrarAbi,
    functionName: "name",
    args: userSubdomainNode ? [userSubdomainNode] : undefined,
    chainId: APP_CHAIN.id,
    query: {
      enabled: Boolean(
        registrarAddress && hasExistingSubdomain && userSubdomainNode,
      ),
    },
  });
  const subdomainNode = useMemo(() => {
    if (!subdomain || !readDomainName.data) return undefined;
    return namehash(`${subdomain}.${readDomainName.data}`);
  }, [readDomainName.data, subdomain]);
  const readSubdomainAvailability = useReadContract({
    address: registrarAddress,
    abi: reserveNameRegistrarAbi,
    functionName: "isSubdomainAvailable",
    args: subdomainNode ? [subdomainNode] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(registrarAddress && subdomainNode) },
  });
  const [isAvailable] = readSubdomainAvailability.data ?? [false];
  const canRegister = Boolean(
    registrarAddress &&
    accountAddress &&
    subdomain &&
    isAvailable &&
    !hasExistingSubdomain,
  );
  const fee = useMemo(() => getReserveNameFee(subdomain), [subdomain]);
  const simulateRegisterSubdomain = useSimulateContract({
    address: registrarAddress,
    abi: reserveNameRegistrarAbi,
    functionName: "registerSubdomain",
    args: accountAddress ? [accountAddress, subdomain] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: canRegister },
    value: fee,
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulateRegisterSubdomain.data?.request;
  const estimateRegister = useEstimateGas({
    chainId: APP_CHAIN.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: reserveNameRegistrarAbi,
          functionName: "registerSubdomain",
          args: [accountAddress!, subdomain],
        })
      : undefined,
    query: {
      select: (gas) => (120n * gas) / 100n,
      enabled: Boolean(request && canRegister),
    },
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const writeRegisterSubdomain = useWriteContract();
  const waitForTransactionRegister = useWaitForTransactionReceipt({
    chainId: APP_CHAIN.id,
    hash: writeRegisterSubdomain.data,
    query: { enabled: Boolean(writeRegisterSubdomain.data) },
  });
  const isFinished =
    writeRegisterSubdomain.isSuccess && waitForTransactionRegister.isSuccess;
  const register = useCallback(() => {
    if (!request) {
      if (simulateRegisterSubdomain.error)
        console.error(simulateRegisterSubdomain.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    writeRegisterSubdomain.writeContract({
      ...request,
      gas: estimateRegister.data,
      value: fee,
    });
  }, [
    estimateRegister.data,
    fee,
    request,
    simulateRegisterSubdomain.error,
    writeRegisterSubdomain,
  ]);
  useLogTransactionErrors([
    simulateRegisterSubdomain,
    estimateRegister,
    writeRegisterSubdomain,
    waitForTransactionRegister,
  ]);

  return {
    readDomainName,
    readUserSubdomain,
    readUserSubdomainName,
    readSubdomainAvailability,
    hasExistingSubdomain,
    userEnsName: readUserSubdomainName.data,
    userSubdomainNode,
    isAvailable,
    domainName: readDomainName.data,
    simulateRegisterSubdomain,
    estimateRegister,
    writeRegisterSubdomain,
    waitForTransactionRegister,
    isFinished,
    register,
    status: getTransactionStatus({
      simulate: simulateRegisterSubdomain,
      estimate: estimateRegister,
      write: writeRegisterSubdomain,
      waitFor: waitForTransactionRegister,
    }),
    reset: writeRegisterSubdomain.reset,
  };
}

/**
 * Escrow Manager Contract Client
 * Handles payments for rental agreements
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import {
  buildContractCall,
  submitTransaction,
  networkConfig,
} from "./stellar-client";

// Get contract ID from environment
const CONTRACT_ID =
  process.env.NEXT_PUBLIC_ESCROW_MANAGER_CONTRACT ||
  "CCDHJMKRNRMJ7HRSJWXJQO7DNTOWHCEOZFRPLZAD6RUHANL2MRJRZWG2";

export enum PaymentType {
  SecurityDeposit = 0,
  FirstMonthRent = 1,
  MonthlyRent = 2,
  DepositRelease = 3,
  EmergencyWithdrawal = 4,
}

export interface PaymentRecord {
  id: string;
  agreementId: string;
  payer: string;
  payee: string;
  amount: bigint;
  paymentType: PaymentType;
  timestamp: number;
}

export interface EscrowAccount {
  agreementId: string;
  landlord: string;
  tenant: string;
  securityDepositAmount: bigint;
  securityDepositHeld: bigint;
  monthlyRentAmount: bigint;
  totalRentReceived: bigint;
  totalRentReleased: bigint;
  isDepositReleased: boolean;
  depositReleasedAt: number;
  createdAt: number;
}

/**
 * Build transaction for initial payment (security deposit + first month rent)
 * This function:
 * 1. Transfers deposit + rent from tenant to escrow
 * 2. Releases first month rent to landlord
 * 3. Holds security deposit
 * 4. Activates the rental agreement
 */
export async function buildDepositAndRentTx(
  tenantAddress: string,
  agreementId: string,
): Promise<StellarSdk.Transaction> {
  const agreementIdBytes = Buffer.from(agreementId, "hex");

  const args = [
    new StellarSdk.Address(tenantAddress).toScVal(),
    StellarSdk.nativeToScVal(agreementIdBytes, { type: "bytes" }),
  ];

  const transaction = await buildContractCall(
    CONTRACT_ID,
    "deposit_security_and_rent",
    args,
    tenantAddress,
  );

  return transaction;
}

/**
 * Build transaction for monthly rent payment
 */
export async function buildPayRentTx(
  tenantAddress: string,
  agreementId: string,
): Promise<StellarSdk.Transaction> {
  const agreementIdBytes = Buffer.from(agreementId, "hex");

  const args = [
    new StellarSdk.Address(tenantAddress).toScVal(),
    StellarSdk.nativeToScVal(agreementIdBytes, { type: "bytes" }),
  ];

  const transaction = await buildContractCall(
    CONTRACT_ID,
    "pay_rent",
    args,
    tenantAddress,
  );

  return transaction;
}

/**
 * Build transaction to release security deposit back to tenant
 * Only works after agreement is completed
 */
export async function buildReleaseDepositTx(
  callerAddress: string,
  agreementId: string,
): Promise<StellarSdk.Transaction> {
  const agreementIdBytes = Buffer.from(agreementId, "hex");

  const args = [
    new StellarSdk.Address(callerAddress).toScVal(),
    StellarSdk.nativeToScVal(agreementIdBytes, { type: "bytes" }),
  ];

  const transaction = await buildContractCall(
    CONTRACT_ID,
    "release_deposit_to_tenant",
    args,
    callerAddress,
  );

  return transaction;
}

/**
 * Get escrow account details for an agreement
 */
export async function getEscrowAccount(
  agreementId: string,
): Promise<EscrowAccount | null> {
  const server = new StellarSdk.rpc.Server(networkConfig.rpcUrl);

  const agreementIdBytes = Buffer.from(agreementId, "hex");

  const args = [StellarSdk.nativeToScVal(agreementIdBytes, { type: "bytes" })];

  const account = await server.getAccount(
    // Use a random address for simulation
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  );

  const contract = new StellarSdk.Contract(CONTRACT_ID);
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call("get_escrow", ...args))
    .setTimeout(30)
    .build();

  try {
    const simulated = await server.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
      return null;
    }

    if (
      StellarSdk.rpc.Api.isSimulationSuccess(simulated) &&
      simulated.result?.retval
    ) {
      return parseEscrowAccount(simulated.result.retval);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get payment history for an agreement
 */
export async function getPaymentHistory(
  agreementId: string,
): Promise<PaymentRecord[]> {
  const server = new StellarSdk.rpc.Server(networkConfig.rpcUrl);

  const agreementIdBytes = Buffer.from(agreementId, "hex");

  const args = [StellarSdk.nativeToScVal(agreementIdBytes, { type: "bytes" })];

  const account = await server.getAccount(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  );

  const contract = new StellarSdk.Contract(CONTRACT_ID);
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call("get_payment_history", ...args))
    .setTimeout(30)
    .build();

  try {
    const simulated = await server.simulateTransaction(transaction);

    if (
      StellarSdk.rpc.Api.isSimulationSuccess(simulated) &&
      simulated.result?.retval
    ) {
      return parsePaymentRecords(simulated.result.retval);
    }

    return [];
  } catch {
    return [];
  }
}

// Helper to parse EscrowAccount from ScVal
function parseEscrowAccount(val: StellarSdk.xdr.ScVal): EscrowAccount {
  const obj = StellarSdk.scValToNative(val);
  return {
    agreementId: Buffer.from(obj.agreement_id).toString("hex"),
    landlord: obj.landlord,
    tenant: obj.tenant,
    securityDepositAmount: BigInt(obj.security_deposit_amount),
    securityDepositHeld: BigInt(obj.security_deposit_held),
    monthlyRentAmount: BigInt(obj.monthly_rent_amount),
    totalRentReceived: BigInt(obj.total_rent_received),
    totalRentReleased: BigInt(obj.total_rent_released),
    isDepositReleased: obj.is_deposit_released,
    depositReleasedAt: Number(obj.deposit_released_at),
    createdAt: Number(obj.created_at),
  };
}

// Helper to parse PaymentRecords from ScVal
function parsePaymentRecords(val: StellarSdk.xdr.ScVal): PaymentRecord[] {
  const arr = StellarSdk.scValToNative(val);
  return arr.map(
    (item: Record<string, unknown>): PaymentRecord => ({
      id: Buffer.from(item.id as Uint8Array).toString("hex"),
      agreementId: Buffer.from(item.agreement_id as Uint8Array).toString("hex"),
      payer: String(item.payer),
      payee: String(item.payee),
      amount: BigInt(item.amount as string | number | bigint),
      paymentType: Number(item.payment_type) as PaymentType,
      timestamp: Number(item.timestamp),
    }),
  );
}

/**
 * Rental Agreement Contract Client
 * Handles interactions with the rental agreement smart contract
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import {
  CONTRACT_IDS,
  simulateContractCall,
  buildContractCall,
} from "./stellar-client";

// Use RENT_AGREEMENT contract ID
const CONTRACT_ID = CONTRACT_IDS.RENT_AGREEMENT;

// Agreement status matching the contract enum
export enum AgreementStatus {
  PendingLandlordApproval = "PendingLandlordApproval",
  Rejected = "Rejected",
  Draft = "Draft",
  PendingTenantSign = "PendingTenantSign",
  PendingLandlordSign = "PendingLandlordSign",
  PendingPayment = "PendingPayment",
  Active = "Active",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface RentalAgreement {
  id: string;
  propertyId: string;
  landlord: string;
  tenant: string;
  monthlyRent: bigint;
  securityDeposit: bigint;
  startDate: number;
  endDate: number;
  status: AgreementStatus;
  landlordSigned: boolean;
  landlordSignedAt: number;
  tenantSigned: boolean;
  tenantSignedAt: number;
  depositPaid: boolean;
  depositPaidAt: number;
  totalRentPaid: bigint;
  monthsPaid: number;
  createdAt: number;
  completedAt: number;
}

/**
 * Parse agreement from contract response
 */
function parseAgreement(val: StellarSdk.xdr.ScVal): RentalAgreement {
  const map = val.map();
  if (!map) throw new Error("Invalid agreement data");

  const get = (key: string) => {
    const entry = map.find((e) => StellarSdk.scValToNative(e.key()) === key);
    return entry ? StellarSdk.scValToNative(entry.val()) : undefined;
  };

  // Parse status enum
  const statusVal = map.find(
    (e) => StellarSdk.scValToNative(e.key()) === "status",
  );
  let status = AgreementStatus.Draft;
  if (statusVal) {
    const statusScVal = statusVal.val();
    // Soroban enums are stored as vec with single symbol
    const native = StellarSdk.scValToNative(statusScVal);
    if (typeof native === "string") {
      status = native as AgreementStatus;
    } else if (Array.isArray(native) && native.length > 0) {
      status = native[0] as AgreementStatus;
    }
  }

  return {
    id: Buffer.from(get("id") as Uint8Array).toString("hex"),
    propertyId: Buffer.from(get("property_id") as Uint8Array).toString("hex"),
    landlord: get("landlord") as string,
    tenant: get("tenant") as string,
    monthlyRent: BigInt(get("monthly_rent") ?? 0),
    securityDeposit: BigInt(get("security_deposit") ?? 0),
    startDate: Number(get("start_date") ?? 0),
    endDate: Number(get("end_date") ?? 0),
    status,
    landlordSigned: get("landlord_signed") ?? false,
    landlordSignedAt: Number(get("landlord_signed_at") ?? 0),
    tenantSigned: get("tenant_signed") ?? false,
    tenantSignedAt: Number(get("tenant_signed_at") ?? 0),
    depositPaid: get("deposit_paid") ?? false,
    depositPaidAt: Number(get("deposit_paid_at") ?? 0),
    totalRentPaid: BigInt(get("total_rent_paid") ?? 0),
    monthsPaid: Number(get("months_paid") ?? 0),
    createdAt: Number(get("created_at") ?? 0),
    completedAt: Number(get("completed_at") ?? 0),
  };
}

/**
 * Get agreements by tenant (read-only)
 */
export async function getAgreementsByTenant(
  tenantAddress: string,
): Promise<RentalAgreement[]> {
  const result = await simulateContractCall(
    CONTRACT_ID,
    "get_agreements_by_tenant",
    [new StellarSdk.Address(tenantAddress).toScVal()],
  );

  if (!result) return [];

  const vec = result.vec();
  if (!vec) return [];

  return vec.map((item) => parseAgreement(item));
}

/**
 * Get agreements by landlord (read-only)
 */
export async function getAgreementsByLandlord(
  landlordAddress: string,
): Promise<RentalAgreement[]> {
  const result = await simulateContractCall(
    CONTRACT_ID,
    "get_agreements_by_landlord",
    [new StellarSdk.Address(landlordAddress).toScVal()],
  );

  if (!result) return [];

  const vec = result.vec();
  if (!vec) return [];

  return vec.map((item) => parseAgreement(item));
}

/**
 * Get single agreement by ID (read-only)
 */
export async function getAgreement(
  agreementId: string,
): Promise<RentalAgreement> {
  const idBytes = Buffer.from(agreementId, "hex");
  const result = await simulateContractCall(CONTRACT_ID, "get_agreement", [
    StellarSdk.nativeToScVal(idBytes, { type: "bytes" }),
  ]);

  if (!result) throw new Error("Agreement not found");

  return parseAgreement(result);
}

/**
 * Build transaction for tenant to request rental (needs wallet signing)
 * Returns both the transaction and generated agreement ID
 */
export async function buildRequestRentalTx(
  tenantAddress: string,
  params: {
    propertyId: string;
    startDate: number; // Unix timestamp
    endDate: number; // Unix timestamp
  },
): Promise<{ transaction: StellarSdk.Transaction; agreementId: Uint8Array }> {
  // Generate 32-byte random agreement ID client-side
  const agreementId = new Uint8Array(32);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(agreementId);
  } else {
    const crypto = await import("crypto");
    crypto.randomFillSync(agreementId);
  }

  const propertyIdBytes = Buffer.from(params.propertyId, "hex");

  const args = [
    new StellarSdk.Address(tenantAddress).toScVal(),
    StellarSdk.nativeToScVal(Buffer.from(agreementId), { type: "bytes" }),
    StellarSdk.nativeToScVal(propertyIdBytes, { type: "bytes" }),
    StellarSdk.nativeToScVal(params.startDate, { type: "u64" }),
    StellarSdk.nativeToScVal(params.endDate, { type: "u64" }),
  ];

  const transaction = await buildContractCall(
    CONTRACT_ID,
    "request_rental",
    args,
    tenantAddress,
  );

  return { transaction, agreementId };
}

/**
 * Build transaction for landlord to approve rental request
 */
export async function buildApproveRequestTx(
  landlordAddress: string,
  agreementId: string,
): Promise<StellarSdk.Transaction> {
  const idBytes = Buffer.from(agreementId, "hex");

  const args = [
    new StellarSdk.Address(landlordAddress).toScVal(),
    StellarSdk.nativeToScVal(idBytes, { type: "bytes" }),
  ];

  return buildContractCall(
    CONTRACT_ID,
    "approve_request",
    args,
    landlordAddress,
  );
}

/**
 * Build transaction for landlord to reject rental request
 */
export async function buildRejectRequestTx(
  landlordAddress: string,
  agreementId: string,
): Promise<StellarSdk.Transaction> {
  const idBytes = Buffer.from(agreementId, "hex");

  const args = [
    new StellarSdk.Address(landlordAddress).toScVal(),
    StellarSdk.nativeToScVal(idBytes, { type: "bytes" }),
  ];

  return buildContractCall(
    CONTRACT_ID,
    "reject_request",
    args,
    landlordAddress,
  );
}

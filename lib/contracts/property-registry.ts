import * as StellarSdk from "@stellar/stellar-sdk";
import {
  CONTRACT_IDS,
  buildContractCall,
  simulateContractCall,
} from "./stellar-client";

// Property type matching the Soroban contract struct
export interface Property {
  id: string; // hex string of BytesN<32>
  owner: string;
  title: string;
  description: string;
  location: string;
  pricePerMonth: bigint; // i128 in stroops
  securityDeposit: bigint;
  minStayDays: number;
  maxStayDays: number;
  imageUrl: string;
  isAvailable: boolean;
  isActive: boolean;
  createdAt: number; // unix timestamp
  updatedAt: number;
}

/**
 * Parse ScVal to Property object
 */
function parseProperty(scVal: StellarSdk.xdr.ScVal): Property {
  const map = scVal.map();
  if (!map) throw new Error("Expected map ScVal");

  const getField = (key: string): StellarSdk.xdr.ScVal | undefined => {
    const entry = map.find((e) => StellarSdk.scValToNative(e.key()) === key);
    return entry?.val();
  };

  return {
    id: Buffer.from(StellarSdk.scValToNative(getField("id")!)).toString("hex"),
    owner: StellarSdk.scValToNative(getField("owner")!),
    title: StellarSdk.scValToNative(getField("title")!),
    description: StellarSdk.scValToNative(getField("description")!),
    location: StellarSdk.scValToNative(getField("location")!),
    pricePerMonth: StellarSdk.scValToNative(getField("price_per_month")!),
    securityDeposit: StellarSdk.scValToNative(getField("security_deposit")!),
    minStayDays: StellarSdk.scValToNative(getField("min_stay_days")!),
    maxStayDays: StellarSdk.scValToNative(getField("max_stay_days")!),
    imageUrl: StellarSdk.scValToNative(getField("image_url")!),
    isAvailable: StellarSdk.scValToNative(getField("is_available")!),
    isActive: StellarSdk.scValToNative(getField("is_active")!),
    createdAt: Number(StellarSdk.scValToNative(getField("created_at")!)),
    updatedAt: Number(StellarSdk.scValToNative(getField("updated_at")!)),
  };
}

/**
 * Get all available properties (read-only)
 */
export async function getAvailableProperties(): Promise<Property[]> {
  const result = await simulateContractCall(
    CONTRACT_IDS.PROPERTY_REGISTRY,
    "get_available_properties",
    [],
  );

  if (!result) return [];

  const vec = result.vec();
  if (!vec) return [];

  return vec.map((item) => parseProperty(item));
}

/**
 * Get a single property by ID (read-only)
 */
export async function getProperty(propertyId: string): Promise<Property> {
  const idBytes = Buffer.from(propertyId, "hex");
  const result = await simulateContractCall(
    CONTRACT_IDS.PROPERTY_REGISTRY,
    "get_property",
    [StellarSdk.nativeToScVal(idBytes, { type: "bytes" })],
  );

  if (!result) throw new Error("Property not found");

  return parseProperty(result);
}

/**
 * Get properties by owner (read-only)
 */
export async function getPropertiesByOwner(
  ownerAddress: string,
): Promise<Property[]> {
  const result = await simulateContractCall(
    CONTRACT_IDS.PROPERTY_REGISTRY,
    "get_properties_by_owner",
    [new StellarSdk.Address(ownerAddress).toScVal()],
  );

  if (!result) return [];

  const vec = result.vec();
  if (!vec) return [];

  return vec.map((item) => parseProperty(item));
}

/**
 * Build transaction to create a property (needs wallet signing)
 */
export async function buildCreatePropertyTx(
  ownerAddress: string,
  params: {
    title: string;
    description: string;
    location: string;
    pricePerMonth: bigint;
    securityDeposit: bigint;
    minStayDays: number;
    maxStayDays: number;
    imageUrl: string;
  },
): Promise<StellarSdk.Transaction> {
  const args = [
    new StellarSdk.Address(ownerAddress).toScVal(),
    StellarSdk.nativeToScVal(params.title, { type: "string" }),
    StellarSdk.nativeToScVal(params.description, { type: "string" }),
    StellarSdk.nativeToScVal(params.location, { type: "string" }),
    StellarSdk.nativeToScVal(params.pricePerMonth, { type: "i128" }),
    StellarSdk.nativeToScVal(params.securityDeposit, { type: "i128" }),
    StellarSdk.nativeToScVal(params.minStayDays, { type: "u32" }),
    StellarSdk.nativeToScVal(params.maxStayDays, { type: "u32" }),
    StellarSdk.nativeToScVal(params.imageUrl, { type: "string" }),
  ];

  return buildContractCall(
    CONTRACT_IDS.PROPERTY_REGISTRY,
    "create_property",
    args,
    ownerAddress,
  );
}

/**
 * Build transaction to set property availability
 */
export async function buildSetAvailabilityTx(
  ownerAddress: string,
  propertyId: string,
  isAvailable: boolean,
): Promise<StellarSdk.Transaction> {
  const idBytes = Buffer.from(propertyId, "hex");

  const args = [
    new StellarSdk.Address(ownerAddress).toScVal(),
    StellarSdk.nativeToScVal(idBytes, { type: "bytes" }),
    StellarSdk.nativeToScVal(isAvailable, { type: "bool" }),
  ];

  return buildContractCall(
    CONTRACT_IDS.PROPERTY_REGISTRY,
    "set_availability",
    args,
    ownerAddress,
  );
}

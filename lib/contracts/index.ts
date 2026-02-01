// Stellar contract integration
export { rpcServer, networkConfig, CONTRACT_IDS } from "./stellar-client";
export {
  buildContractCall,
  submitTransaction,
  simulateContractCall,
} from "./stellar-client";

// Property Registry
export type { Property } from "./property-registry";
export {
  getAvailableProperties,
  getProperty,
  getPropertiesByOwner,
  buildCreatePropertyTx,
  buildSetAvailabilityTx,
} from "./property-registry";

// Rental Agreement
export type { RentalAgreement } from "./rental-agreement";
export { AgreementStatus } from "./rental-agreement";
export {
  getAgreementsByTenant,
  getAgreementsByLandlord,
  getAgreement,
  buildRequestRentalTx,
  buildApproveRequestTx,
  buildRejectRequestTx,
} from "./rental-agreement";

// Escrow Manager
export type { EscrowAccount, PaymentRecord } from "./escrow-manager";
export { PaymentType } from "./escrow-manager";
export {
  buildDepositAndRentTx,
  buildPayRentTx,
  buildReleaseDepositTx,
  getEscrowAccount,
  getPaymentHistory,
} from "./escrow-manager";

// Wallet hook (for client components)
export { useWallet } from "./use-wallet";

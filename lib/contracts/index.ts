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

// Wallet hook (for client components)
export { useWallet } from "./use-wallet";

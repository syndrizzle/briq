import * as StellarSdk from "@stellar/stellar-sdk";

// Network configuration from environment
const NETWORK = process.env.STELLAR_NETWORK || "testnet";
const RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

// Contract addresses from environment
export const CONTRACT_IDS = {
  BRIQ_TOKEN: process.env.BRIQ_TOKEN_CONTRACT!,
  ESCROW_MANAGER: process.env.ESCROW_MANAGER_CONTRACT!,
  RENT_AGREEMENT: process.env.RENT_AGREEMENT_CONTRACT!,
  PROPERTY_REGISTRY: process.env.PROPERTY_REGISTRY_CONTRACT!,
  REVIEW_AGREEMENT: process.env.REVIEW_AGREEMENT_CONTRACT!,
} as const;

// Initialize Soroban RPC client
export const rpcServer = new StellarSdk.rpc.Server(RPC_URL);

// Export network config for transaction building
export const networkConfig = {
  network: NETWORK,
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
};

/**
 * Build a contract call transaction
 */
export async function buildContractCall(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sourcePublicKey: string,
): Promise<StellarSdk.Transaction> {
  const sourceAccount = await rpcServer.getAccount(sourcePublicKey);

  const contract = new StellarSdk.Contract(contractId);
  const operation = contract.call(method, ...args);

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100000", // 0.01 XLM base fee
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  // Simulate to get the proper footprint and fees
  const simulated = await rpcServer.simulateTransaction(transaction);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  // Assemble the transaction with simulation results
  const assembled = StellarSdk.rpc
    .assembleTransaction(transaction, simulated)
    .build();

  return assembled;
}

/**
 * Submit a signed transaction and wait for result
 */
export async function submitTransaction(
  signedXdr: string,
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE,
  );

  const response = await rpcServer.sendTransaction(transaction);

  if (response.status === "ERROR") {
    throw new Error(`Transaction failed: ${response.errorResult}`);
  }

  // Poll for result
  let result = await rpcServer.getTransaction(response.hash);
  while (result.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await rpcServer.getTransaction(response.hash);
  }

  return result;
}

/**
 * Read-only contract call (no signing required)
 */
export async function simulateContractCall(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
): Promise<StellarSdk.xdr.ScVal | undefined> {
  // For read-only calls, we use a dummy source
  const dummySource =
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

  const contract = new StellarSdk.Contract(contractId);
  const operation = contract.call(method, ...args);

  // Create a minimal transaction for simulation
  const account = new StellarSdk.Account(dummySource, "0");
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulated = await rpcServer.simulateTransaction(transaction);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  if (StellarSdk.rpc.Api.isSimulationSuccess(simulated) && simulated.result) {
    return simulated.result.retval;
  }

  return undefined;
}

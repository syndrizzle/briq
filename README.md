# Briq - Decentralized Rental Platform

![Briq Banner](public/background.webp)

Briq is a decentralized home rental platform built on the Stellar blockchain. It reimagines the rental experience by bringing trust, transparency, and efficiency to landlords and tenants through smart contracts.

## 🚀 Problem Statement

The traditional rental market is plagued by inefficiencies:

- **Lack of Transparency**: Hidden fees and ambiguous contract terms.
- **Trust Issues**: Tenants worry about fake listings; landlords worry about non-payment.
- **Deposit Disputes**: Security deposits are often withheld unfairly or delayed.
- **High Intermediary Fees**: Agents and platforms charge significant commissions.

**Briq solves this by:**

- Using **Smart Contracts** to automate agreements and payments.
- Holding funds in **Escrow** until conditions are met.
- verifying ownership and reputation on-chain.
- Eliminating unnecessary middlemen, reducing costs for everyone.

## ✨ Features

- **🏠 Decentralized Listings**: Landlords can list properties directly on the blockchain.
- **🤝 Smart Rental Agreements**: Digital agreements that are immutable and transparent.
- **💰 Secure Escrow Payments**: Rent and security deposits are held in a smart contract escrow, released only when agreed conditions are met.
- **⭐ Reputation System**: On-chain reviews for both tenants and landlords to build long-term trust.
- **👛 Wallet Integration**: Seamless login and transaction signing using Freighter wallet.
- **📱 Responsive Dashboard**: a modern, mobile-friendly interface for managing properties and agreements.

## 🏗️ Architecture Overview

Briq leverages a modern tech stack to deliver a Web2-like user experience with Web3 power:

- **Frontend**: Next.js 14 (React), Tailwind CSS, shadcn/ui
- **Blockchain**: Stellar Network (Soroban Smart Contracts)
- **Smart Contracts**: Written in Rust
  - `Property Registry`: Manages property metadata and ownership.
  - `Rental Agreement`: Handles agreement states (Draft, Active, Completed).
  - `Escrow Manager`: Securely holds and releases funds.
  - `Review System`: Manages immutable user reviews.
- **Authentication**: Hybrid approach using Better Auth (Google OAuth) for user metadata and Freighter Wallet for on-chain actions.

## 🔗 Contract Addresses (Stellar Testnet)

| Contract              | Address                                                    |
| --------------------- | ---------------------------------------------------------- |
| **Property Registry** | `CAGKEFUVMDN3RRM73DLNYVVHVRG5VNOK762NLMSPAMXQXTBHYAPSWEFM` |
| **Rental Agreement**  | `CCLNXBXEJOV36AQOBCQONDAVXUDHAU7Y5YNUWTKHE24O6INFGSR2T7V5` |
| **Escrow Manager**    | `CBWNWCDTZZFXEMWUUY6YNH3Y5IDM23TQ2XB4224T6UGWNLMBIWSYWZMD` |
| **Review System**     | `CA7KR5DFPUB5F2VHIDFM3PLYAZY6ZNQMUP3AJF7DNOBDAMBOWJW4OCJN` |
| **Briq Token**        | `CAX7TF4WI5O3NTOPE4TCZXHCPEPI4WKME6YE4OVB5RQU2QI7BGPFYUAO` |

## 📸 Screenshots

### Landing Page

![Landing Page](https://via.placeholder.com/800x450?text=Landing+Page+Screenshot)
_Modern, high-converting landing page with transparent navigation._

### Landlord Dashboard

![Landlord Dashboard](https://via.placeholder.com/800x450?text=Landlord+Dashboard)
_Manage properties, track earnings, and view requests._

### Property Listings

![Property Listings](https://via.placeholder.com/800x450?text=Property+Listings)
_Browse available properties with rich details._

### Rental & Escrow

![Agreements](https://via.placeholder.com/800x450?text=Agreements+Interface)
_Track active agreements and escrow status._

## 🔮 Future Scope & Plans

- **Mainnet Launch**: Deploy contracts to Stellar Mainnet.
- **Dispute Resolution DAO**: Community-governed dispute resolution for escrow releases.
- **Cross-Chain Payments**: Accept stablecoins (USDC) and other crypto assets.
- **Identity Verification**: Integration with potentially verifiable credentials (VCs) for stronger identity checks.
- **Mobile App**: Native mobile application for on-the-go management.

---

Built with ❤️ by the Briq Team.

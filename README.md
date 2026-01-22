# StreamPay ⚡

> Interval-based payment streaming on Bitcoin via Stacks. Payments unlock at fixed intervals, withdraw anytime, settle instantly.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Stacks](https://img.shields.io/badge/Built%20on-Stacks-purple)](https://stacks.co)
[![Testnet](https://img.shields.io/badge/Live%20on-Testnet-green)](https://explorer.hiro.so/?chain=testnet)

---

## 🎯 Problem

Traditional payments are **discrete and inflexible**:

* 💼 Employees wait weeks for paychecks → cash flow problems
* 🎨 Freelancers invoice monthly → delayed payment, uncertainty
* 📺 Subscriptions charge upfront → paying for unused time
* 🤝 Grant recipients get lump sums → no accountability, misaligned incentives

**Result**: Inefficient capital allocation, trust issues, and financial stress.

---

## 💡 Solution

**StreamPay** enables **continuous, interval-based payment streams** on Stacks using SIP-010 tokens (USDCx, STX, sBTC).

### Core Features

* ⚡ **Flexible Intervals**: Per block, hourly, daily, or custom
* 💰 **Anytime Withdrawals**: Recipients access earned funds 24/7
* ⏸️ **Pause / Resume**: Senders can pause streams (settles owed amount first)
* 🔝 **Top-up**: Extend stream duration by adding more funds
* 🔒 **Bitcoin-Secured**: Built on Stacks L2, inheriting Bitcoin security
* 🌐 **Multi-Token**: Any SIP-010 fungible token
* 📊 **Event Logging**: All actions emit indexable on-chain events

### Advanced Capabilities

* 🎯 **Lazy Accounting**: Gas-efficient on-demand calculations
* 🛡️ **Safety Limits**: Rate, interval, and deposit caps
* 🔄 **BNS Integration**: Human-readable `.btc` addresses
* ✅ **Instant Settlement**: Cancel streams with automatic prorated refunds
* 📱 **Real-Time Updates**: Frontend refreshes every 30 seconds

---

## 🚀 Live Demo

**Try it now (no installation required):**

* 🌐 **Live App**: [https://streampay-9ui8.vercel.app/](https://streampay-9ui8.vercel.app/)
* 📜 **Testnet Contract**: `ST30J9EZKY44SS1EBT8XNKJFA77Z4TSDBEMZ55MEJ.precious-white-sparrow`
* 🔍 **Block Explorer**: [https://explorer.hiro.so/txid/ST30J9EZKY44SS1EBT8XNKJFA77Z4TSDBEMZ55MEJ.precious-white-sparrow?chain=testnet](https://explorer.hiro.so/txid/ST30J9EZKY44SS1EBT8XNKJFA77Z4TSDBEMZ55MEJ.precious-white-sparrow?chain=testnet)
* 🎥 **Demo Video**: [https://www.youtube.com/watch?v=WNxcNMz-GNA](https://www.youtube.com/watch?v=WNxcNMz-GNA)

### Quick Start (Judges)

1. Visit the live app
2. Connect Hiro or Leather wallet (testnet)
3. Mint test USDCx
4. Create a stream
5. Withdraw in real time

---

## ✨ Key Innovations

### 1. Interval-Based Streaming

Supports **custom payment intervals**, not only per-block:

* Hourly (~720 blocks)
* Daily (~17,280 blocks)
* Custom (1 to 100M blocks)

This aligns payments with real-world billing cycles while remaining gas-efficient.

### 2. Pause Without Losing Funds

Pausing a stream:

1. Settles all owed funds
2. Freezes accrual
3. Can resume at any time

No funds are lost.

### 3. Dynamic Top-Ups

Extend streams by adding funds mid-stream:

```ts
// 100 USDCx for 100 days
// +50 USDCx top-up
// → Stream now lasts 150 days
```

### 4. Multi-Token via SIP-010

```clarity
(define-public (create-stream
  (recipient principal)
  (rate uint)
  (deposit uint)
  (interval uint)
  (token <ft-trait>)
))
```

Works with any present or future SIP-010 token.

---

## 🏗️ Architecture

### High-Level Flow

```
Sender ── Create Stream ──► Contract ──► Recipient
         Deposit Funds               Withdraw Anytime
```

### Lazy Accounting Formula

```clarity
intervals = (current-block - last-withdraw-block) / interval
ewarned = intervals * rate
owed = min(earned, remaining-deposit)
```

---

## 🛠️ Technology Stack

### Smart Contracts

* Language: Clarity 2.0
* Network: Stacks Testnet
* Standard: SIP-010
* Tooling: Clarinet

### Frontend

* Framework: Next.js 14 (App Router)
* Language: TypeScript
* Wallets: Hiro, Leather
* Styling: Tailwind CSS
* Deployment: Vercel

---

## 📦 Local Setup

```bash
# Clone repository
git clone https://github.com/Ghislo749/streampay
cd streampay/frontend

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔒 Security Highlights

* Integer overflow protection (Clarity-native)
* Strict sender / recipient authorization
* Reentrancy-safe execution model
* Idempotent withdrawals
* Input safety limits

| Scenario            | Safe       |
| ------------------- | ---------- |
| Same-block withdraw | ✅          |
| Pause without owed  | ✅          |
| Interval = 0        | ❌ Rejected |

---

## 🗺️ Roadmap

### Phase 1 — Complete

* Core streaming
* Pause / Resume
* Top-ups
* Multi-token support
* Testnet deployment

### Phase 2 — Enhancements

* Batch operations
* Stream templates
* Scheduled streams
* Analytics dashboard

### Phase 3 — Integrations

* STX402 API (micropayment-based)
* DAO & bounty streaming
* Cross-chain support

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

## 👤 Author

**YOUR NAME**

* GitHub: [https://github.com/Ghislo749](https://github.com/Ghislo749)
* Twitter: [https://x.com/Ghislo749_](https://x.com/Ghislo749_)

---

**Built on Stacks · Secured by Bitcoin · Powered by USDCx**

*Making payments flow like time itself* ⏰

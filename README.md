<div align="center">

# 🏏 IPL Auction Simulator 2025

A rich, real-time multiplayer application designed to simulate the fast-paced thrill of the Indian Premier League (IPL) mega auctions. Built with Next.js and Socket.IO for seamless real-time bidding, this simulator allows friends to gather in private rooms, select their favorite franchises, and battle it out for top cricket talents!

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black?style=for-the-badge&logo=socket.io)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

**[🌟 Live Demo: Play IPL Auction Simulator Here!](https://auctionsimulator.onrender.com)**

</div>

---

## ✨ Features

- **🏆 Real-Time Multiplayer Rooms**: Create private auction rooms with unique 6-character room codes and invite your friends.
- **⚡ Live Bidding Engine**: High-performance socket-based architecture handles rapid bids, calculates automatic bid increments, and enforces a synchronized countdown timer.
- **🏏 Complete IPL 2025 Player Roster**: Built-in support to parse and load the official IPL mega auction player list directly from a CSV file.
- **💰 Team Purses & Squad Limits**: Real-time purse deduction, automatic tracking of available squad slots, and overseas player limits just like the real auction.
- **💬 Live Room Chat**: Communicate with other franchise owners in real-time as the drama unfolds.
- **⏸️ Auction Controls**: The room host has complete control to pause, resume, and gracefully end the auction at any time.

## 🚀 Quick Start

### Prerequisites
Make sure you have Node.js (v18+) and npm installed on your machine.

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/Nishanthtamil/AuctionSimulator.git
cd AuctionSimulator
```

2. **Install dependencies:**
```bash
npm install
```

3. **Provide Player Data:**
Ensure the `ipl_2025_auction_players_12.csv` file is located in the root directory.

4. **Start the Development Server:**
```bash
npm run dev
```
The application runs a custom Next.js server with Socket.IO attached. It will be available at [http://localhost:3000](http://localhost:3000).

## 🛠️ Technology Stack

| Technology | Purpose |
| ---------- | ------- |
| **Next.js 14** | Core framework, React Server Components, Routing |
| **React 18** | UI component library |
| **Socket.IO** | Bi-directional, real-time event-based communication |
| **TypeScript** | Type-safe development |
| **Node.js** | Custom server environment (`server.ts`) running via `tsx` |
| **Zod** | Schema validation |
| **CSV Parser** | Streaming player dataset from CSV on server boot |

## 🏗️ Project Structure

```text
AuctionSimulator/
├── src/
│   └── app/               # Next.js App Router frontend components and pages
├── public/                # Static assets like team logos
├── server.ts              # Custom Node.js/Socket.IO server entry point
├── package.json           # Dependencies and project scripts
└── ipl_2025_auction_players_12.csv # The dataset of players
```

> [!TIP]
> **Modifying Teams:** You can add, remove, or modify the franchises participating in the auction by modifying the `IPL_TEAMS` constant in `server.ts`.

## 🎮 How to Play
1. **Host** creates a new room, getting a unique Room Code.
2. **Players** join the room using the code and select an available franchise.
3. The **Host** clicks "Start Auction" to bring up the first player.
4. Players bid in real-time! The system automatically calculates the correct incremental bid amount based on the current price slab.
5. Watch the timer—if it expires without new bids, the player is sold to the highest bidder!

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📜 License
This project is for educational and entertainment purposes.

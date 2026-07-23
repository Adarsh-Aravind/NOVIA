# NOVIA

<p align="center">
  <a href="https://github.com/Adarsh-Aravind/NOVIA">
    <img src="https://readme-typing-svg.herokuapp.com?font=Inter&weight=400&size=24&pause=1000&color=333333&center=true&vCenter=true&width=500&lines=The+Ultimate+App+for+Couples;Stay+Connected;Track+Milestones;Grow+Together" alt="Typing SVG" />
  </a>
</p>

NOVIA (Noviris) is a React Native application designed for couples to stay connected, organized, and engaged on a daily basis.

## Features

- **Relationship Milestones:** Track anniversaries and special dates with push notifications.
- **Daily Check-ins & Streaks:** Share daily feelings and build streaks together.
- **Complaint Threads:** A structured space to voice and resolve disagreements.
- **Shared Todos:** Manage shared tasks with real-time push notifications.
- **Finance Tracker:** Track shared expenses and manage couple finances seamlessly.
- **Cycle Tracker:** Integrated period and ovulation predictions using custom cycle math.
- **Daily Vocabulary:** Learn new words daily together.
- **Realtime Sync & OTA Updates:** Built on Supabase for instant data sync, and Expo EAS for over-the-air updates.

## Getting Started

### Prerequisites
- Node.js & npm
- Expo CLI
- Supabase Project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `eas.example.json` to `eas.json` and configure your Supabase URL and Anon Key.
   - Copy `.env.example` to `.env`.
4. Start the development server:
   ```bash
   npm start
   ```

## Tech Stack
- **Framework:** React Native / Expo
- **Backend:** Supabase (PostgreSQL, Realtime, Auth)
- **Build & Deploy:** EAS Build & Update

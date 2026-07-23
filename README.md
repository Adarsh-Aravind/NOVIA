# NOVIA

<p align="center">
  <a href="https://github.com/Adarsh-Aravind/NOVIA">
    <img src="https://readme-typing-svg.herokuapp.com?font=Inter&weight=400&size=24&pause=1000&color=333333&center=true&vCenter=true&width=500&lines=The+Ultimate+App+for+Couples;Stay+Connected;Track+Milestones;Grow+Together" alt="Typing SVG" />
  </a>
</p>

NOVIA (Noviris) is a comprehensive React Native application engineered to help couples maintain connection, organization, and healthy engagement on a daily basis.

## System Architecture

NOVIA leverages a modern mobile stack tailored for cross-platform availability and real-time synchronization:

- **Frontend:** React Native running on the Expo framework, ensuring seamless cross-platform consistency across iOS and Android.
- **Backend:** Supabase infrastructure providing PostgreSQL for relational data, Realtime for instant state synchronization across clients, and Auth for secure access management.
- **Deployment:** Expo Application Services (EAS) handles both native builds (APK/IPA) and over-the-air (OTA) updates, bypassing standard store review processes for javascript-level logic changes.

## Core Features

- **Relationship Milestones:** A specialized tracking system for anniversaries and custom dates. Integrated directly with the native notification scheduler to provide timely push alerts.
- **Daily Check-ins & Analytics:** Allows daily sentiment sharing between partners. Data is aggregated to display engagement streaks and historical relationship health metrics.
- **Complaint Threads:** A structured, real-time communication channel dedicated to voicing and resolving disagreements constructively.
- **Shared Task Management:** A synchronized Todo system featuring a custom time picker and real-time push notifications upon task completion or updates.
- **Finance & Expense Tracking:** A comprehensive module designed for dual-party expense tracking, facilitating seamless management of shared financial resources.
- **Cycle Tracking:** Integrates predictive period and ovulation modeling using localized, custom cycle mathematics.
- **Vocabulary Builder:** Curated educational content designed to expand vocabulary, synchronized daily.

## Project Structure

The codebase is modularized within the `src` directory to maintain scalability and separation of concerns:

```text
src/
├── components/   # Reusable, stateless UI components
├── constants/    # Theme definitions, global configuration, and string constants
├── hooks/        # Custom React hooks (e.g., Supabase data fetching, auth state)
├── services/     # External integrations (e.g., Push Notifications, OTA Updates)
├── types/        # TypeScript interface definitions and global types
├── utils/        # Pure helper functions (e.g., cycle math, async locks)
└── views/        # Top-level screen components representing individual application routes
```

## Local Development

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Expo CLI
- A configured Supabase Project

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Adarsh-Aravind/NOVIA.git
   cd NOVIA
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   For local development, create a `.env` file based on the provided example template:
   ```bash
   cp .env.example .env
   ```
   For build configurations, duplicate the EAS configuration template and populate it with your Supabase credentials:
   ```bash
   cp eas.example.json eas.json
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```
   You can then run the application using Expo Go or a locally booted emulator (`a` for Android, `i` for iOS).

## Deployment & Updates

NOVIA relies on Expo EAS for continuous deployment.

### Over-The-Air (OTA) Updates
Changes to JavaScript, styling, or business logic can be shipped directly to installed clients without requiring a native app reinstall:
```bash
eas update --channel production --message "Describe changes here"
```

### Native Builds
If native dependencies or plugins are altered, a new native build must be compiled:
```bash
eas build --platform all --profile production
```

# Workout Sync

A mobile-first web application that allows users to upload workout photos and sync them to Hevy. Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- 📸 **Photo Upload**: Upload workout screenshots from gym screens or selfies
- 🔄 **Auto-detect Workouts**: Mock image processing to extract exercise data (ready for real API integration)
- ✏️ **Edit & Review**: Review and edit detected exercises, sets, reps, and weight
- 🔗 **Hevy Sync**: Automatically sync workouts to Hevy (mock implementation ready for real API)
- 📱 **Mobile-First Design**: Optimized for mobile devices with smooth animations
- 🎨 **Modern UI**: Clean, professional interface using shadcn/ui components

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (New York style)
- **Icons**: Lucide React
- **State Management**: React Context API

## Getting Started

### Prerequisites

- Node.js 22+ (using nvm)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd workout-sync
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## User Flow

```
Landing Page → Upload Photo → Review Workout → Sync to Hevy → Complete
```

### 1. Landing Page (`/`)
- Welcome screen with "Upload Workout Photo" button
- Feature highlights and how-it-works section

### 2. Upload Page (`/upload`)
- Upload area with camera icon (tap to upload or select from library)
- Sync options: "Sync to Hevy" and "Share to Instagram" toggles
- Caption textarea for adding notes
- "Complete Upload" button to process the image

### 3. Review Page (`/review`)
- Real-time workout timer
- Workout summary cards (Duration, Volume, Sets)
- Exercise cards with editable sets (KG and REPS)
- Add/remove sets functionality
- "Finish" button to sync workout

### 4. Sync Page (`/sync`)
- Animated sync progress with circular progress indicator
- Sequential exercise syncing animation
- Workout summary with synced/pending status badges
- Connected accounts display (Hevy, Strava)
- "Go to Dashboard" button

## Project Structure

```
workout-sync/
├── app/
│   ├── page.tsx              # Landing page
│   ├── upload/page.tsx       # Upload photo screen
│   ├── review/page.tsx       # Review/edit workout screen
│   ├── sync/page.tsx         # Sync progress screen
│   ├── layout.tsx            # Root layout with WorkoutProvider
│   └── globals.css           # Global styles with animations
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── WorkoutSummaryCard.tsx
│   ├── ExerciseCard.tsx
│   ├── ExerciseRow.tsx
│   ├── SyncStatusBadge.tsx
│   ├── ConnectedAccountCard.tsx
│   └── LoadingSpinner.tsx
├── contexts/
│   └── WorkoutContext.tsx    # Global workout state
├── lib/
│   ├── types.ts              # TypeScript type definitions
│   ├── mock-data.ts          # Mock data and API functions
│   └── utils.ts              # Utility functions
└── components.json           # shadcn/ui configuration
```

## Key Features Implementation

### Mock Image Processing
Currently uses hardcoded data that returns "Push Press" with 5 sets. Ready to integrate with:
- OpenAI Vision API (GPT-4 Vision)
- Google Cloud Vision API
- Custom ML model

### Mock Hevy API Sync
Simulates API calls with delays and progress tracking. Ready to integrate with:
- Hevy API endpoints
- Authentication flow
- Real workout data submission

### State Management
Uses React Context API for global state:
- Uploaded image
- Processed exercises
- Sync preferences
- Caption/notes

### Responsive Design
- Mobile-first approach
- Touch-optimized buttons (min 44px targets)
- Safe area padding for iOS devices
- Smooth animations and transitions
- Custom scrollbar styling

## Mock Data Structure

Exercises follow the Hevy API structure:

```typescript
{
  id: "uuid",
  title: "Exercise Name",
  type: "weight_reps",
  primary_muscle_group: "chest",
  secondary_muscle_groups: ["triceps"],
  is_custom: false
}
```

## Future Enhancements

- [ ] Integrate real image processing API (OpenAI/Google Vision)
- [ ] Connect to real Hevy API with OAuth
- [ ] Add user authentication
- [ ] Implement local/remote database for workout history
- [ ] Add Instagram story template generation
- [ ] Support multiple workout formats
- [ ] Add exercise library search
- [ ] Implement workout templates
- [ ] Add progress tracking and analytics

## Styling Customization

The app uses Tailwind CSS with custom CSS variables defined in `globals.css`:
- Primary color: Blue (#0066FF / hsl(221 83% 53%))
- Destructive color: Red
- Smooth transitions and animations
- Custom focus states for accessibility

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding New Components

```bash
npx shadcn@latest add [component-name]
```

## License

This project is private and not licensed for public use.

## Support

For questions or issues, please contact the development team.

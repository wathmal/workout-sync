# Workout Sync

A mobile-first web application that allows users to upload workout photos and sync them to Hevy. Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- 📸 **Photo Upload**: Upload workout screenshots from gym screens or selfies with EXIF date extraction
- 🤖 **AI-Powered Workout Detection**: Uses Groq Vision API (Llama 4 Scout) to automatically extract exercises, sets, reps, and weights from workout photos
- 🔍 **Intelligent Exercise Matching**: Fuzzy matching system maps detected exercises to Hevy's database of 453 exercises
- ✏️ **Edit & Review**: Review and edit detected exercises, sets, reps, and weight with image zoom/pan
- 📅 **Date & Time Management**: Automatic date extraction from image EXIF data with manual override
- 🔗 **Hevy Sync**: Real-time sync to Hevy API with duplicate workout detection
- 🔎 **Exercise Search**: Search and replace exercises from Hevy's exercise database
- 📱 **Mobile-First Design**: Optimized for mobile devices with smooth animations
- 🎨 **Modern UI**: Clean, professional interface using shadcn/ui components

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (New York style)
- **Icons**: Lucide React
- **State Management**: React Context API
- **AI/ML**: Groq Vision API (Llama 4 Scout 17B)
- **APIs**: Hevy API, Groq API
- **Image Processing**: EXIF extraction, zoom/pan with react-zoom-pan-pinch
- **Containerization**: Docker/Podman support with multi-stage builds
- **Deployment**: Optimized for TrueNAS Scale and Docker Hub

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

4. Create a `.env.local` file with your API keys (see `env.example`):
```bash
cp env.example .env.local
# Edit .env.local with your actual API keys
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

The application requires the following environment variables:

- `HEVY_API_KEY` - Your Hevy API key (get from Hevy app settings)
- `GROQ_API_KEY` - Your Groq API key (get from https://console.groq.com/)

See `env.example` for a template.

## Docker Deployment

### Building with Docker

1. **Build the Docker image:**
```bash
docker build -t workout-sync:latest .
```

2. **Test locally:**
```bash
docker run -d \
  --name workout-sync \
  -p 3000:3000 \
  -e HEVY_API_KEY="your_hevy_api_key" \
  -e GROQ_API_KEY="your_groq_api_key" \
  workout-sync:latest
```

3. **Push to Docker Hub:**
```bash
# Login to Docker Hub
docker login

# Tag the image
docker tag workout-sync:latest YOUR_DOCKERHUB_USERNAME/workout-sync:latest

# Push to Docker Hub
docker push YOUR_DOCKERHUB_USERNAME/workout-sync:latest
```

### Building with Podman

1. **Build the Podman image:**
```bash
podman build -t workout-sync:latest .
```

2. **Test locally:**
```bash
podman run -d \
  --name workout-sync \
  -p 3000:3000 \
  -e HEVY_API_KEY="your_hevy_api_key" \
  -e GROQ_API_KEY="your_groq_api_key" \
  workout-sync:latest
```

3. **Push to Docker Hub:**
```bash
# Login to Docker Hub
podman login docker.io

# Tag the image (include full registry URL)
podman tag workout-sync:latest docker.io/YOUR_DOCKERHUB_USERNAME/workout-sync:latest

# Push to Docker Hub
podman push docker.io/YOUR_DOCKERHUB_USERNAME/workout-sync:latest
```

**Note:** With Podman, always include the full registry URL (`docker.io/`) when tagging and pushing.

### Version Tagging (Recommended)

Instead of always using `latest`, consider versioning your images:

```bash
# Docker
docker tag workout-sync:latest YOUR_DOCKERHUB_USERNAME/workout-sync:v1.0.0
docker push YOUR_DOCKERHUB_USERNAME/workout-sync:v1.0.0

# Podman
podman tag workout-sync:latest docker.io/YOUR_DOCKERHUB_USERNAME/workout-sync:v1.0.0
podman push docker.io/YOUR_DOCKERHUB_USERNAME/workout-sync:v1.0.0
```

### Deploying to TrueNAS Scale

For detailed deployment instructions on TrueNAS Scale, see [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md).

**Quick steps:**
1. Push your image to Docker Hub (see above)
2. In TrueNAS Scale UI: **Apps** → **Custom App** → **Install**
3. Set image repository: `YOUR_DOCKERHUB_USERNAME/workout-sync`
4. Configure environment variables (`HEVY_API_KEY`, `GROQ_API_KEY`)
5. Set port mapping (container: 3000, host: your preferred port)
6. Configure Docker Hub credentials for private repositories

## User Flow

```
Landing Page → Upload Photo → Review Workout → Sync to Hevy → Complete
```

### 1. Landing Page (`/`)
- Welcome screen with "Upload Workout Photo" button
- Feature highlights and how-it-works section

### 2. Upload Page (`/upload`)
- Upload area with camera icon (tap to upload or select from library)
- Image validation (JPEG, PNG, WebP up to 20MB)
- "Upload" button to process the image with Groq Vision API
- Automatic fallback to sample data if API key not configured

### 3. Review Page (`/review`)
- Image preview with zoom/pan functionality
- Workout summary cards (Duration, Volume, Sets)
- Exercise cards with editable sets (KG and REPS)
- Add/remove sets and exercises functionality
- Exercise search and replacement from Hevy database
- Date and time picker (auto-filled from EXIF data)
- Caption/notes textarea
- Duplicate workout detection and warning
- "Finish" button to sync workout to Hevy

### 4. Sync Page (`/sync`)
- Animated sync progress with circular progress indicator
- Sequential exercise syncing animation
- Workout summary with synced/pending status badges
- Connected accounts display (Hevy)
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
│   ├── mock-data.ts          # API client functions and fallback data
│   ├── groq-helpers.ts       # Groq API integration and parsing
│   ├── hevy-api.ts           # Hevy API integration and transformation
│   ├── hevy-exercises.ts     # Hevy exercise database (453 exercises)
│   ├── fuzzy-match.ts        # Fuzzy matching algorithms
│   ├── image-utils.ts        # EXIF date extraction utilities
│   └── utils.ts              # Utility functions
├── docs/
│   └── DOCKER_DEPLOYMENT.md  # Docker deployment guide for TrueNAS Scale
├── Dockerfile                 # Production Docker image definition
├── .dockerignore             # Docker build context exclusions
├── env.example               # Environment variables template
└── components.json           # shadcn/ui configuration
```

## Key Features Implementation

### AI-Powered Image Processing
Uses **Groq Vision API** with the `meta-llama/llama-4-scout-17b-16e-instruct` model to:
- Extract exercise names, sets, reps, and weights from workout photos
- Parse structured JSON responses from the AI model
- Automatic fallback to sample data if `GROQ_API_KEY` is not configured (allows testing without API key)
- Image validation (file type and size limits)

### Intelligent Exercise Matching
Fuzzy matching system that maps detected exercise names to Hevy's official database:
- **453 exercises** in database (429 official, 24 custom)
- Multi-factor scoring: Levenshtein distance, word overlap, equipment matching
- Handles abbreviations, variations, and compound exercises
- Creates custom exercises only when no match is found above threshold

### Hevy API Integration
Real-time sync to Hevy's workout API:
- Transforms workout data to Hevy's format
- Validates workout data before submission
- Handles API errors with user-friendly messages
- Duplicate workout detection by date

### EXIF Date Extraction
Automatically extracts workout date and time from image metadata:
- Reads EXIF DateTimeOriginal tag
- Calculates workout start time
- Falls back to manual date/time selection if EXIF not available

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

## Data Structures

### Exercise Format
Exercises follow the Hevy API structure:

```typescript
{
  id: "uuid",
  title: "Exercise Name",
  type: "weight_reps",
  primary_muscle_group: "chest",
  secondary_muscle_groups: ["triceps"],
  is_custom: false,
  equipment: "barbell"
}
```

### Workout Format
Workouts are structured as:

```typescript
{
  id: "uuid",
  date: Date,
  duration_minutes: number,
  caption: string,
  exercises: WorkoutExercise[]
}
```

## Future Enhancements

- [ ] Add user authentication
- [ ] Implement local/remote database for workout history
- [ ] Add Instagram story template generation
- [ ] Support multiple workout formats (cardio, timed exercises)
- [ ] Implement workout templates
- [ ] Add progress tracking and analytics
- [ ] Strava integration
- [ ] Batch upload multiple workout photos
- [ ] Workout history and statistics dashboard

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
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

### Docker/Podman Commands

- `docker build -t workout-sync:latest .` - Build Docker image
- `podman build -t workout-sync:latest .` - Build Podman image
- `docker run -p 3000:3000 -e HEVY_API_KEY=... -e GROQ_API_KEY=... workout-sync:latest` - Run container locally

See the [Docker Deployment](#docker-deployment) section above for detailed instructions.

### Adding New Components

```bash
npx shadcn@latest add [component-name]
```

## License

This project is private and not licensed for public use.

## Support

For questions or issues, please contact the development team.

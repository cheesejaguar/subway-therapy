# Subway Therapy

A virtual sticky note wall inspired by the NYC Subway Therapy movement, where people can leave anonymous messages, drawings, and thoughts on a shared public wall.

## Features

- **Interactive Wall**: A massive virtual wall (1000 ft x 7 ft) where users can place sticky notes
- **Drawing & Typing**: Create notes by drawing or typing messages
- **Multiple Colors**: Choose from various sticky note colors
- **AI Content Moderation**: Automatic content moderation using Llama 4 Scout via Vercel AI Gateway
- **Community Flagging**: Users can flag inappropriate content
- **Admin Dashboard**: Review and moderate submissions at `/admin`
- **Mobile Friendly**: Touch-optimized with smooth pan and zoom

## Tech Stack

- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Convex
- **Image Storage**: Vercel Blob
- **AI Moderation**: Vercel AI Gateway (meta/llama-4-scout)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Convex account (free tier available)
- Vercel account (for Blob storage and AI Gateway)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/cheesejaguar/subway-therapy.git
   cd subway-therapy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Fill in your environment variables in `.env.local`

5. Set up Convex:
   ```bash
   npx convex dev
   ```

6. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the wall.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_API_KEY` | Yes (prod) | Admin dashboard authentication key |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob storage token |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL |
| `CONVEX_DEPLOY_KEY` | Yes (prod) | Convex deployment key |
| `VERCEL_AI_API_KEY` | No | Enables automatic AI content moderation |
| `NEXT_PUBLIC_SITE_URL` | No | Site URL for SEO metadata |

## AI Moderation

When `VERCEL_AI_API_KEY` is configured, submitted notes are automatically analyzed using Llama 4 Scout:

- **Auto-approved**: Content with high confidence of being appropriate
- **Auto-rejected**: Content that clearly violates guidelines
- **Pending**: Low-confidence results go to manual review

### Moderation Cost

| Per Note | Per 1,000 Notes |
|----------|-----------------|
| ~$0.00011 | ~$0.11 |

Based on ~1,200 input tokens (prompt + image) and ~50 output tokens per moderation.

## Admin Dashboard

Access the admin panel at `/admin` to:

- View pending, approved, rejected, and flagged notes
- Approve or reject submissions
- Delete inappropriate content
- Monitor submission statistics

## Deployment

Deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cheesejaguar/subway-therapy)

Make sure to configure all required environment variables in your Vercel project settings.

## License

MIT

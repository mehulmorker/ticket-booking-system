# Multi-stage Dockerfile supporting both development and production
ARG NODE_VERSION=18-alpine
FROM node:${NODE_VERSION} AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Build stage - installs all dependencies and builds
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# Development stage - installs all dependencies (including dev)
FROM base AS development
RUN npm install
EXPOSE 3002
CMD ["npm", "run", "start:dev"]

# Production stage - only production dependencies
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --only=production
# Install ts-node, typescript, and tsconfig-paths for running migrations and seeders
# Note: Install as regular dependencies (not --save-dev) to ensure they're available
RUN npm install ts-node typescript tsconfig-paths
COPY --from=builder /app/dist ./dist
# Copy migration and seeder source files (needed for running migrations and seeders)
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/src/migrations ./src/migrations
COPY --from=builder /app/src/seeders ./src/seeders
# Copy entity source files (seeders import entities from source paths)
COPY --from=builder /app/src/venues ./src/venues
COPY --from=builder /app/src/events ./src/events
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3002
CMD ["node", "dist/main"]

# Default to production
FROM production

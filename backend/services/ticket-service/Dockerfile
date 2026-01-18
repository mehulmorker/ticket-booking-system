# Multi-stage Dockerfile supporting both development and production
ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION} AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Build stage - installs all dependencies and builds
FROM base AS builder
RUN npm install
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Development stage - installs all dependencies (including dev)
FROM base AS development
RUN npm install
EXPOSE 3006
CMD ["npm", "run", "start:dev"]

# Production stage - only production dependencies
FROM base AS production
ENV NODE_ENV=production
RUN npm install --only=production
# Install ts-node, typescript, and tsconfig-paths for running migrations
# Note: Install as regular dependencies (not --save-dev) to ensure they're available
RUN npm install ts-node typescript tsconfig-paths
COPY --from=builder /app/dist ./dist
# Copy migration source files (needed for running migrations)
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/src/migrations ./src/migrations
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3006
CMD ["node", "dist/main.js"]

# Default to production
FROM production

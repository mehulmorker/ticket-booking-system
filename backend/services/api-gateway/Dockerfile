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
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Production stage - only production dependencies
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]

# Default to production
FROM production

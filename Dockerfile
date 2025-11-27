# Eclesiar Wars – Dockerfile for Coolify deployment
# Structure: backend/ (Express API) + frontend/ (Vue/Vite SPA)

# ============ Build stage ============
FROM node:20-alpine AS build
WORKDIR /app

# 1. Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# 2. Install frontend dependencies & build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ============ Runtime stage ============
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

# Copy backend source (no build step – plain JS)
COPY backend/ ./backend/
# Copy production node_modules from build stage
COPY --from=build /app/backend/node_modules ./backend/node_modules

# Copy built frontend into backend/public so Express can serve it
COPY --from=build /app/frontend/dist ./backend/public

EXPOSE 3002

# Start backend (serves API + static frontend)
CMD ["node", "backend/src/index.js"]

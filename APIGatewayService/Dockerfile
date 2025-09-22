# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM base AS build
COPY . .
RUN npm run generate:openapi || true

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["node", "src/server.js"]

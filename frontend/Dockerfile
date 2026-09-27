# syntax=docker/dockerfile:1

# ---- Build: compile the Vite app to static files ----------------------------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

# ---- Runtime: nginx serves the build and proxies /api to the backend -------
FROM nginx:1.30-alpine AS runtime

# The nginx image renders /etc/nginx/templates/*.template with envsubst at
# startup, so the backend address is config rather than baked into the image.
ENV API_UPSTREAM=http://backend:3001
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

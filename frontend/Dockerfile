# Production image for the Seat Booking React/Vite frontend.
# Build context must be the frontend/ directory (see docker-compose.yml).
#
# IMPORTANT: Vite bakes every VITE_* variable into the built JS at BUILD time,
# not at container start. That means this image is tied to whatever
# VITE_* build args it was built with - to point the same app at a different
# backend URL, rebuild the image with different --build-arg values, don't
# expect one image to work unmodified across environments.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

ARG VITE_API_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_ENTRA_TENANT_ID
ARG VITE_ENTRA_REDIRECT_URI
ENV VITE_API_URL=$VITE_API_URL \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID \
    VITE_ENTRA_TENANT_ID=$VITE_ENTRA_TENANT_ID \
    VITE_ENTRA_REDIRECT_URI=$VITE_ENTRA_REDIRECT_URI

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

# Stage 1: Build Vite React App
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_BACKEND_URL
ARG VITE_BOT_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_BOT_URL=$VITE_BOT_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN test -n "$VITE_BACKEND_URL" \
  && test -n "$VITE_SUPABASE_URL" \
  && test -n "$VITE_SUPABASE_ANON_KEY" \
  || (echo "Missing required Vite build variable(s): VITE_BACKEND_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY" >&2 && exit 1)

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: High-Performance Nginx Alpine Server
FROM nginx:alpine AS runner

# Replace default Nginx configuration
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

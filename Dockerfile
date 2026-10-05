# Stage 1: Build Vite React App
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_BACKEND_URL=https://api.enlightmetals.com
ARG VITE_SUPABASE_URL=https://supabase.enlightmetals.com
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3OTAwNjM2NjksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.ZUUqJnSFw86p3RDih77HDSmN-CUQrAv6IaH1OrdzlFM

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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

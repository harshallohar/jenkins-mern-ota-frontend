# Stage 1: Build the frontend using Node
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with NGINX + HTTPS support
FROM nginx:alpine

# Remove default HTML
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy HTTPS-enabled NGINX config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Expose HTTP + HTTPS ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

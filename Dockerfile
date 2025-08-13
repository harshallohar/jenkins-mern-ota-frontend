# Stage 1: Build the frontend using Node
FROM node:20-alpine AS builder
 AS builder

WORKDIR /app

# Only install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Now copy the full app and build it
COPY . .
RUN npm run build

# Stage 2: Serve with NGINX
FROM nginx:alpine

# Remove default content
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy your custom NGINX config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

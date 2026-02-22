# Use official Node.js 24.10 image
FROM node:24.10-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production \
    && npm install express@5.2.1 --legacy-peer-deps \
    && npm install class-transformer --legacy-peer-deps \
    && npm install -g socket.io --legacy-peer-deps

# Copy the rest of the application (including src, public, build, etc.)
COPY . .

# Build TypeScript (output goes to /app/build)
RUN npm run build && mkdir -p build/src/utils && cp src/utils/*.js build/src/utils/

# Start the app from /app, using the compiled JS (relative path)
CMD ["node", "build/src/index.js"]

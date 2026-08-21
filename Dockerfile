FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Expose port (Cloud Run defaults to 8080, but we use 3000 as per AI Studio defaults)
# Let's ensure our server respects the PORT env var if set by Cloud Run, otherwise fallback to 3000
EXPOSE 3000

# Start the compiled server
CMD ["npm", "start"]

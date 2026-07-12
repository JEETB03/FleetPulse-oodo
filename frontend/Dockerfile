FROM node:20-slim

WORKDIR /app

# Install dependencies first for caching
COPY package.json .
RUN npm install

# Copy code
COPY . .

# Expose Vite port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev"]

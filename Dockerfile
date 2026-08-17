FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --production

# Copy app
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]

FROM node:18-alpine

WORKDIR /app

# Install dependencies first (layer-cached unless package.json changes)
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

EXPOSE 3000

# npm start delegates to whatever the package.json "start" script defines.
# detect_runtime.py already confirmed this script exists before this
# Dockerfile is used, so this CMD will not silently exit.
CMD ["npm", "start"]

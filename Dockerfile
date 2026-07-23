FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN mkdir -p knowledge media sessions logs

EXPOSE 3004

CMD ["node", "index.js"]

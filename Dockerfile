FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
RUN npx playwright install --with-deps firefox
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]

FROM node:20-alpine

WORKDIR /app

COPY server.js data.js pdf.js ./
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]

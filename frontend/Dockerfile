FROM node:20-alpine AS builder

WORKDIR /app

# ENV NODE_ENV=production

COPY package*.json ./
RUN npm install

COPY vite.config.* tsconfig.* index.html ./ 
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/vite.config.* ./
COPY --from=builder /app/index.html ./

EXPOSE 4173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]


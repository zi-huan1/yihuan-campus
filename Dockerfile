FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm run install:all
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p server/data server/uploads server/logs && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server/src/index.js"]

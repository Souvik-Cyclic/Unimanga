# Development container for the Expo app.
#
# The image is not a production artifact - React Native ships through EAS
# builds - but it gives every contributor the same Node toolchain and lets the
# Metro bundler run without installing anything locally.

FROM node:20-alpine

RUN apk add --no-cache git bash

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV EXPO_NO_TELEMETRY=1
ENV CI=1

# Metro bundler and the Expo dev server.
EXPOSE 8081 19000 19001 19006

CMD ["npx", "expo", "start", "--tunnel"]

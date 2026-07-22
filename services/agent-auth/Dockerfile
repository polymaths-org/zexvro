FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    AGENT_AUTH_PORT=4103 \
    GATE_REQUIRE_POP=true \
    GATE_STATE_BACKEND=dynamo \
    GATE_DYNAMO_TABLE=zexvro-agent-auth \
    GATE_BASE_PATH=/gate \
    AGENT_AUTH_ISSUER=https://api.zexvro.in/gate \
    GATE_ALLOW_DEV_HUMAN=false \
    GATE_ALLOW_DEV_HMAC=false \
    GATE_ADMIN_REQUIRE_AUTH=true
# Inject AGENT_AUTH_SIGNING_SECRET via App Runner RuntimeEnvironmentSecrets.
# Optional: GATE_CORS_ORIGINS, COGNITO_*, GATE_ADMIN_REQUIRE_AUTH=false for bootstrap.
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 4103
USER node
CMD ["node", "dist/server.js"]

# Prefer AWS Public ECR mirror to avoid Docker Hub rate limits in CodeBuild.
FROM public.ecr.aws/docker/library/node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html metadata.json ./
COPY public ./public
COPY src ./src
COPY server.ts ./
RUN npm run build && npm prune --omit=dev

FROM public.ecr.aws/docker/library/node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    LABS_STATE_BACKEND=dynamo \
    LABS_DYNAMO_REGION=us-east-1 \
    LABS_DYNAMO_TABLE=zexvro-labs
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Inject LABS_SESSION_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET via App Runner
# RuntimeEnvironmentSecrets. Optional: GEMINI_API_KEY for live AI mentorship.
EXPOSE 3000
USER node
CMD ["node", "dist/server.mjs"]
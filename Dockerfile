FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY app ./app
COPY scripts ./scripts
COPY docs ./docs
COPY tests ./tests
COPY deploy ./deploy
COPY pnpm-lock.yaml pnpm-workspace.yaml Dockerfile compose.yaml .dockerignore .gitignore ./
COPY *.md ./
RUN npm run build

FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

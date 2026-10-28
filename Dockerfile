# 여행 동선 플래너 — 웹앱을 빌드해서 nginx로 서비스하는 이미지
# API 키는 이미지에 넣지 않는다. 컨테이너를 켤 때 환경변수로 넘기면 docker/40-app-config.sh 가 /config.js 로 만들어 준다.
#
#   docker build -t trabel_1 .
#   docker run -p 8080:80 --env-file .env.local trabel_1      → http://localhost:8080

# 1단계: 빌드
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2단계: 서비스
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-app-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

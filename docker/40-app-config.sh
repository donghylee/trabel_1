#!/bin/sh
# nginx 컨테이너가 켜질 때 실행됨 (/docker-entrypoint.d).
# 환경변수로 받은 API 키를 브라우저가 읽는 /config.js 로 만든다 — 키를 이미지에 굽지 않기 위해.
# .env.local 을 --env-file 로 그대로 넘길 수 있도록 VITE_ 가 붙은 이름도 받는다.
set -e

# JSON 문자열 안에 넣을 수 있게 \ 와 " 를 이스케이프
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-${VITE_GOOGLE_MAPS_API_KEY:-}}"
GOOGLE_MAP_ID="${GOOGLE_MAP_ID:-${VITE_GOOGLE_MAP_ID:-}}"
TMAP_APP_KEY="${TMAP_APP_KEY:-${VITE_TMAP_APP_KEY:-}}"
ODSAY_API_KEY="${ODSAY_API_KEY:-${VITE_ODSAY_API_KEY:-}}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  GOOGLE_MAPS_API_KEY: "$(esc "$GOOGLE_MAPS_API_KEY")",
  GOOGLE_MAP_ID: "$(esc "$GOOGLE_MAP_ID")",
  TMAP_APP_KEY: "$(esc "$TMAP_APP_KEY")",
  ODSAY_API_KEY: "$(esc "$ODSAY_API_KEY")"
}
EOF

# 어떤 키가 설정됐는지만 로그에 남김 (값은 출력하지 않음)
for name in GOOGLE_MAPS_API_KEY TMAP_APP_KEY ODSAY_API_KEY; do
  eval "value=\${$name}"
  if [ -n "$value" ]; then echo "config.js: $name 설정됨"; else echo "config.js: $name 없음"; fi
done

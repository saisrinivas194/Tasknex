#!/usr/bin/env bash
API_URL="https://tasknex-production.up.railway.app/api"  # or your Railway backend + /api

login_response=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "saisrinivaspedhapolla@gmail.com",
    "password": "10020102@Ssr"
  }')

echo "Login response:"
echo "$login_response"
echo

# Try to get token; exit early if missing
token=$(echo "$login_response" | python3 -c 'import sys, json
data = json.load(sys.stdin)
print(data.get("access_token", ""))')

if [ -z "$token" ]; then
  echo "No access_token in response; stopping."
  exit 1
fi

echo "Auth me:"
curl -s -H "Authorization: Bearer $token" "$API_URL/auth/me"
echo
#!/usr/bin/env bash
API_URL="https://tasknex-production.up.railway.app/api"  # or Railway backend + /api
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "saisrinivaspedhapolla@gmail.com",
    "password": "10020102@Ssr"
  }')
body=$(echo "$response" | sed '$d')
code=$(echo "$response" | tail -n1)
echo "Status: $code"
echo "Body: $body"

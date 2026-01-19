#!/bin/bash

# ログイン
echo "=== Login ==="
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123456"}' | jq -r '.data.token')

echo "Token: ${TOKEN:0:50}..."

# テンプレート一覧取得
echo -e "\n=== Templates List ==="
TEMPLATES=$(curl -s http://localhost:3000/api/templates \
  -H "Authorization: Bearer $TOKEN")

echo "$TEMPLATES" | jq '.'

# テンプレートIDを取得
TEMPLATE_ID=$(echo "$TEMPLATES" | jq -r '.data.templates[0].template_id')

if [ "$TEMPLATE_ID" = "null" ] || [ -z "$TEMPLATE_ID" ]; then
  echo "No templates found. Please upload a template first."
  exit 1
fi

echo -e "\n=== Testing Template ID: $TEMPLATE_ID ==="

# 項目一覧を取得
echo -e "\n=== Get Template Fields ==="
TEMPLATE_DETAIL=$(curl -s http://localhost:3000/api/templates/$TEMPLATE_ID \
  -H "Authorization: Bearer $TOKEN")

echo "$TEMPLATE_DETAIL" | jq '.data.fields | length'

# 項目更新をテスト
echo -e "\n=== Test Field Update ==="
UPDATE_RESULT=$(curl -s -X PATCH http://localhost:3000/api/templates/$TEMPLATE_ID/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "field_id": 1,
      "include_in_form": 1,
      "field_name": "テスト項目1"
    },
    {
      "field_id": 2,
      "include_in_form": 0,
      "field_name": "テスト項目2"
    }
  ]')

echo "$UPDATE_RESULT" | jq '.'


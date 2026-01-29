#!/bin/bash
# テンプレート削除スクリプト（本番環境用）

echo "==================================="
echo "テンプレートデータ削除スクリプト"
echo "==================================="
echo ""

echo "📊 ステップ1: 現在のデータ件数を確認"
echo "-----------------------------------"
echo "🔍 テンプレート数:"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM templates"
echo ""
echo "🔍 フォーム数:"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM forms"
echo ""
echo "🔍 見積書数:"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM quotes"
echo ""
echo "🔍 テンプレートフィールド数:"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM template_fields"
echo ""

echo "⚠️  警告: これらのデータはすべて削除されます"
echo ""
read -p "削除を実行しますか？ (yes と入力して Enter): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ 削除をキャンセルしました"
    exit 0
fi

echo ""
echo "🗑️  ステップ2: テンプレートデータを削除"
echo "-----------------------------------"
npx wrangler d1 execute webapp-production --command="DELETE FROM templates"
echo "✅ テンプレートを削除しました"
echo ""

echo "🔄 ステップ3: ユーザーのテンプレート作成数をリセット"
echo "-----------------------------------"
npx wrangler d1 execute webapp-production --command="UPDATE users SET templates_created = 0"
echo "✅ ユーザーのカウンターをリセットしました"
echo ""

echo "📊 ステップ4: 削除後のデータ件数を確認"
echo "-----------------------------------"
echo "🔍 テンプレート数:"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM templates"
echo ""
echo "🔍 フォーム数:"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM forms"
echo ""
echo "🔍 見積書数:"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM quotes"
echo ""
echo "🔍 テンプレートフィールド数:"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM template_fields"
echo ""

echo "==================================="
echo "✅ 削除処理が完了しました"
echo "==================================="

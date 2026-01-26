# エクセルまもる君 - MVP版

ExcelテンプレートからAIで項目を自動抽出し、見積書を自動生成するWebアプリケーション

## 📋 プロジェクト概要

- **サービス名**: エクセルまもる君
- **目的**: Excelの見積書テンプレートをアップロードして、AIで項目を自動抽出し、入力フォームを生成。フォーム入力から見積書Excelを自動作成。
- **技術スタック**: Cloudflare Pages + Hono + TypeScript + Gemini API
- **ターゲット**: 中小企業の営業・経理担当者

## 🌐 URLs

- **本番環境**: https://webapp-bhm.pages.dev （固定URL）
- **開発環境**: https://3000-i33nb43dtt3rbqdym56j6-c07dda5e.sandbox.novita.ai
- **GitHub**: https://github.com/SYD-watanabe/Report-creation
- **プランアップグレード**: https://www.netpr.biz/report-creation-orderform

## ✅ 完了した機能

### 1. 認証機能
- ✅ ユーザー登録（email, password, name）
- ✅ ログイン（JWT認証）
- ✅ ログアウト
- ✅ 認証ミドルウェア

### 2. テンプレート管理
- ✅ Excelテンプレートアップロード（.xlsx, .xls）
- ✅ テンプレート一覧表示
- ✅ テンプレート詳細表示
- ✅ テンプレート削除
- ✅ ファイルサイズ制限（10MB）
- ✅ プラン制限チェック（無料: 1テンプレート）

### 3. AI項目抽出機能
- ✅ Gemini APIでExcelファイルを解析
- ✅ 項目名、セル位置、データ型を自動抽出
- ✅ 計算式の抽出
- ✅ 入力項目/計算項目/固定値の分類
- ✅ 抽出結果の確認・表示
- ✅ 抽出項目のデータベース保存
- ✅ 項目の編集（項目名、フォームへの含む/除外、必須設定）

### 4. フォーム生成機能 🆕
- ✅ 抽出項目から動的フォームを生成
- ✅ フォーム固有URL発行（8文字のランダムURL）
- ✅ 外部公開フォーム（認証不要）
- ✅ フォーム一覧・管理画面
- ✅ フォームの公開/非公開切り替え
- ✅ アクセス数・送信数のトラッキング
- ✅ 入力データのバリデーション（必須項目チェック）
- ✅ 計算項目の自動計算

### 5. 見積書管理機能 🆕
- ✅ フォーム入力データの受信・保存
- ✅ 計算式の自動実行
- ✅ 見積書一覧表示（管理画面）
- ✅ 見積書詳細表示（入力データ・計算結果）
- ✅ 見積書削除機能

### 6. Excel生成機能 🆕
- ✅ ExcelJSでテンプレートを読み込み
- ✅ セル位置（A3, B7など）を使用した正確なデータ埋め込み
- ✅ 元のExcelテンプレートの書式を完全維持
- ✅ 計算式の維持
- ✅ Cloudflare R2への保存
- ✅ Excel形式でのダウンロード

## 🚧 未実装の機能

### 7. PDF生成機能（後回し）
- ⏳ ExcelからPDFへの変換

### 8. Stripe決済統合
- ⏳ プレミアムプランへのアップグレード
- ⏳ Stripe Checkout統合
- ⏳ Webhook処理
- ⏳ サブスクリプション管理
- ⏳ プランのキャンセル

## 🗄️ データアーキテクチャ

### データベース: Cloudflare D1（SQLite）

**主要テーブル:**

1. **users** - ユーザー情報
   - user_id, email, password_hash, name
   - current_plan (free/premium)
   - templates_created

2. **user_subscriptions** - サブスクリプション情報
   - subscription_id, user_id, plan_type
   - template_limit, payment_status
   - stripe_subscription_id

3. **templates** - テンプレート情報
   - template_id, user_id, template_name
   - file_path, file_type, file_size
   - quotes_created

4. **template_fields** - 抽出された項目情報
   - field_id, template_id, field_name
   - field_type (input/calc/fixed)
   - data_type (text/number/date)
   - cell_position, calculation_formula
   - is_required, display_order

5. **forms** - 生成されたフォーム情報
   - form_id, template_id, form_url
   - form_title, is_active
   - access_count, submission_count

6. **quotes** - 作成された見積書情報
   - quote_id, form_id, template_id
   - input_data (JSON), calculated_data (JSON)
   - file_path, file_name

### ストレージ: Cloudflare R2

- **テンプレートファイル**: `templates/{user_id}/{timestamp}_{filename}.xlsx`
- **生成された見積書**: `quotes/{user_id}/quote_{quote_id}.xlsx`

**R2ステータス**: ✅ 有効化済み（2026-01-26）

## 🔐 セキュリティ

- **認証**: JWT（24時間有効期限）
- **パスワード**: Web Crypto API（SHA-256）でハッシュ化
- **API認証**: Bearer Token
- **CORS**: APIルートのみ有効化

## 🚀 開発環境セットアップ

### 必要な環境変数

`.dev.vars` ファイルを作成：

```bash
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
```

**Gemini APIキーの取得方法:**
1. https://aistudio.google.com/app/apikey にアクセス
2. Googleアカウントでログイン
3. "Create API Key"をクリック
4. APIキーをコピーして`.dev.vars`に貼り付け

### ローカル開発

```bash
# 依存関係のインストール
npm install

# データベース初期化
curl -X POST http://localhost:3000/api/db/init

# ビルド
npm run build

# PM2でサーバー起動
pm2 start ecosystem.config.cjs

# サーバー確認
curl http://localhost:3000/api/health
```

## 📊 料金プラン

### 無料プラン
- テンプレート数: 1個まで
- 見積書作成: 無制限
- 保存期間: 30日間

### プレミアムプラン（¥5,000/月）
- テンプレート数: 無制限
- 見積書作成: 無制限
- 保存期間: 無期限
- フォームURL: 無制限
- 優先サポート

## 🧪 デモアカウント

- **メールアドレス**: demo@example.com
- **パスワード**: demo123456

## 📈 次の開発ステップ

### Phase 2（優先度: 高）
1. ✅ ~~AI項目抽出機能~~ → **完了**
2. ⏳ フォーム生成機能（動的フォームUI）
3. ⏳ 見積書PDF生成機能

### Phase 3（優先度: 中）
4. ⏳ Stripe決済統合
5. ⏳ フォームのカスタマイズ機能
6. ⏳ 見積書管理機能

## 📝 Git履歴

```bash
git log --oneline
e184f55 Add AI field extraction feature with Gemini API
a2600d6 Add template management feature (upload, list, delete)
8841e04 Add authentication system
[以前のコミット...]
```

## 🛠️ 技術詳細

### フロントエンド
- **UI**: Tailwind CSS（CDN）
- **アイコン**: Font Awesome
- **HTTP Client**: Fetch API
- **状態管理**: LocalStorage（JWT, ユーザー情報）

### バックエンド
- **フレームワーク**: Hono v4
- **ランタイム**: Cloudflare Workers
- **データベース**: D1（SQLite）
- **ストレージ**: R2（S3互換）
- **AI**: Gemini API（gemini-pro）
- **Excel解析**: xlsx ライブラリ

### デプロイ
- **プラットフォーム**: Cloudflare Pages
- **ビルドツール**: Vite
- **開発サーバー**: Wrangler + PM2

## 🔧 トラブルシューティング

### Gemini APIエラー
- APIキーが正しく設定されているか確認: `.dev.vars`
- APIキーの有効期限を確認
- Gemini APIの利用制限を確認

### テンプレートアップロード失敗
- ファイルサイズが10MB以下か確認
- ファイル形式が.xlsxまたは.xlsか確認
- プラン制限（無料: 1テンプレート）を確認

### データベースエラー
- データベース初期化: `curl -X POST http://localhost:3000/api/db/init`
- ローカルD1の削除: `rm -rf .wrangler/state/v3/d1`

## 📞 サポート

質問やバグ報告は、GitHubのIssuesまたはプロジェクト管理者にお問い合わせください。

---

**最終更新日**: 2026-01-26
**バージョン**: MVP v0.6.1
**現在のデプロイ**: `fe1b89e7` (コミット: `3e88889` - Excelアップロード後にAI項目抽出を自動実行)
**ステータス**: ✅ 本番環境稼働中 - パスワードリセット機能実装前のバージョン

## 📝 変更履歴

### 2026-01-26 - ロールバック実施
- **理由**: パスワードリセット機能実装中にビルドエラーが発生
- **対応**: デプロイメント `fe1b89e7` にロールバック
- **現在の機能**: AI自動抽出、テンプレート管理、フォーム生成、見積書管理（全て正常動作）
- **未実装**: アカウント情報管理、パスワードリセット機能

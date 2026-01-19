import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractedField {
  field_name: string;
  field_type: 'input' | 'calc' | 'fixed';
  data_type: 'text' | 'number' | 'date';
  cell_position: string;
  calculation_formula?: string;
  fixed_value?: string;
  is_required: number;
  display_order: number;
}

export interface ExtractionResult {
  fields: ExtractedField[];
  confidence: number;
  suggestions?: string[];
}

/**
 * Gemini APIを使ってExcelテンプレートから項目を抽出
 */
export async function extractFieldsWithGemini(
  excelSummary: string,
  apiKey: string
): Promise<ExtractionResult> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-2.5-flash-lite を試す
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `
あなたはExcelの見積書テンプレートを分析するAIアシスタントです。
以下のExcelファイルの解析結果から、入力フォームを生成するための項目情報を抽出してください。

【Excelファイル解析結果】
${excelSummary}

【抽出する情報】
1. field_name: 項目名（例: "会社名", "金額", "消費税"）
2. field_type: 項目タイプ
   - "input": ユーザーが入力する項目
   - "calc": 計算式で自動計算される項目
   - "fixed": 固定値（テンプレートに既に記載されている値）
3. data_type: データ型（"text", "number", "date"のいずれか）
4. cell_position: セル位置（例: "A1", "B5"）
5. calculation_formula: 計算式（field_typeが"calc"の場合のみ。例: "=SUM(B2:B10)"）
6. fixed_value: 固定値（field_typeが"fixed"の場合のみ）
7. is_required: 必須かどうか（1: 必須, 0: 任意）
8. display_order: 表示順序（1から始まる連番）

【抽出ルール】
- 項目名らしいテキストが近くのセルにある場合は、その値を使用
- 数式（Formula）がある場合は、field_type="calc"として抽出
- 日付や金額など、明確なパターンがある場合は適切なdata_typeを設定
- ユーザーが入力すべき項目を優先的に抽出（会社名、担当者名、商品名、単価、数量など）
- 計算項目（小計、合計、消費税など）も抽出
- 最大20項目まで抽出

【出力形式】
以下のJSON形式で出力してください。JSON以外のテキストは含めないでください。

{
  "fields": [
    {
      "field_name": "項目名",
      "field_type": "input",
      "data_type": "text",
      "cell_position": "A1",
      "is_required": 1,
      "display_order": 1
    }
  ],
  "confidence": 0.85,
  "suggestions": ["補足情報や注意事項"]
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSONを抽出（```json ``` で囲まれている場合に対応）
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(jsonText);
    
    // バリデーション
    if (!parsed.fields || !Array.isArray(parsed.fields)) {
      throw new Error('Invalid response format from Gemini API');
    }
    
    // デフォルト値の設定
    const fields: ExtractedField[] = parsed.fields.map((field: any, index: number) => ({
      field_name: field.field_name || `項目${index + 1}`,
      field_type: field.field_type || 'input',
      data_type: field.data_type || 'text',
      cell_position: field.cell_position || 'A1',
      calculation_formula: field.calculation_formula || null,
      fixed_value: field.fixed_value || null,
      is_required: field.is_required !== undefined ? field.is_required : 1,
      display_order: field.display_order !== undefined ? field.display_order : index + 1
    }));
    
    return {
      fields,
      confidence: parsed.confidence || 0.7,
      suggestions: parsed.suggestions || []
    };
  } catch (error: any) {
    console.error('Gemini API error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // エラーメッセージを詳細に表示
    const errorMessage = error?.message || 'Unknown error';
    const errorStatus = error?.status || error?.response?.status;
    
    if (errorStatus === 404) {
      throw new Error(`Gemini APIエンドポイントが見つかりません。モデル名を確認してください: ${errorMessage}`);
    } else if (errorStatus === 403 || errorStatus === 401) {
      throw new Error(`Gemini APIキーが無効です: ${errorMessage}`);
    } else {
      throw new Error(`AI項目抽出に失敗しました: ${errorMessage}`);
    }
  }
}

/**
 * 抽出結果をデータベース形式に変換
 */
export function convertToDbFields(
  fields: ExtractedField[],
  templateId: number
): any[] {
  return fields.map(field => ({
    template_id: templateId,
    field_name: field.field_name,
    field_type: field.field_type,
    data_type: field.data_type,
    cell_position: field.cell_position,
    calculation_formula: field.calculation_formula || null,
    fixed_value: field.fixed_value || null,
    is_required: field.is_required,
    display_order: field.display_order
  }));
}

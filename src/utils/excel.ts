import * as XLSX from 'xlsx';

export interface ExcelCellInfo {
  address: string;
  value: any;
  formula?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'formula' | 'empty';
}

export interface ExcelSheetInfo {
  name: string;
  cells: ExcelCellInfo[];
  range: string;
}

export interface ExcelAnalysis {
  sheets: ExcelSheetInfo[];
  totalSheets: number;
}

/**
 * Excelファイルを解析してセル情報を抽出
 */
export async function analyzeExcelFile(arrayBuffer: ArrayBuffer): Promise<ExcelAnalysis> {
  try {
    // ArrayBufferからWorkbookを読み込み
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellFormula: true, cellStyles: true });
    
    const sheets: ExcelSheetInfo[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      
      const cells: ExcelCellInfo[] = [];
      
      // 全セルをスキャン（最大100行×50列まで）
      const maxRow = Math.min(range.e.r, 99);
      const maxCol = Math.min(range.e.c, 49);
      
      for (let row = range.s.r; row <= maxRow; row++) {
        for (let col = range.s.c; col <= maxCol; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          
          if (cell) {
            const cellInfo: ExcelCellInfo = {
              address: cellAddress,
              value: cell.v,
              formula: cell.f,
              type: getCellType(cell)
            };
            
            cells.push(cellInfo);
          }
        }
      }
      
      sheets.push({
        name: sheetName,
        cells,
        range: worksheet['!ref'] || 'A1'
      });
    }
    
    return {
      sheets,
      totalSheets: workbook.SheetNames.length
    };
  } catch (error) {
    console.error('Excel analysis error:', error);
    throw new Error('Excelファイルの解析に失敗しました');
  }
}

/**
 * セルのデータ型を判定
 */
function getCellType(cell: XLSX.CellObject): ExcelCellInfo['type'] {
  if (cell.f) return 'formula';
  
  switch (cell.t) {
    case 's': return 'string';
    case 'n': return 'number';
    case 'b': return 'boolean';
    case 'd': return 'date';
    case 'z': return 'empty';
    default: return 'string';
  }
}

/**
 * Excelファイルの概要をテキスト形式で生成（Gemini API用）
 */
export function generateExcelSummary(analysis: ExcelAnalysis, maxCells: number = 200): string {
  let summary = `Excel File Analysis:\n`;
  summary += `Total Sheets: ${analysis.totalSheets}\n\n`;
  
  for (const sheet of analysis.sheets) {
    summary += `Sheet: "${sheet.name}" (Range: ${sheet.range})\n`;
    summary += `Total Cells: ${sheet.cells.length}\n\n`;
    
    // 重要なセル情報を抽出（空白でない、またはラベルっぽいセル）
    const importantCells = sheet.cells
      .filter(cell => {
        // 空白セルを除外
        if (!cell.value && !cell.formula) return false;
        
        // 数式セルは常に含める
        if (cell.formula) return true;
        
        // 文字列でラベルっぽいものを含める（項目名など）
        if (cell.type === 'string' && typeof cell.value === 'string') {
          const trimmed = cell.value.trim();
          // 日本語文字、英数字、記号を含む短いテキスト（ラベルの可能性）
          if (trimmed.length > 0 && trimmed.length < 100) {
            return true;
          }
        }
        
        // 数値セルで計算に使われそうなもの
        if (cell.type === 'number' || cell.type === 'formula') {
          return true;
        }
        
        return false;
      })
      .slice(0, maxCells);
    
    summary += `Important Cells (${importantCells.length}):\n`;
    for (const cell of importantCells) {
      if (cell.formula) {
        summary += `  ${cell.address}: Formula="${cell.formula}" Value=${cell.value}\n`;
      } else {
        summary += `  ${cell.address}: ${cell.type}="${cell.value}"\n`;
      }
    }
    summary += `\n`;
  }
  
  return summary;
}

/**
 * Gemini APIからの抽出結果を検証
 */
export function validateExtractedFields(fields: any[]): boolean {
  if (!Array.isArray(fields)) return false;
  
  for (const field of fields) {
    // 必須フィールドのチェック
    if (!field.field_name || typeof field.field_name !== 'string') return false;
    if (!field.cell_position || typeof field.cell_position !== 'string') return false;
    if (!field.field_type || !['input', 'calc', 'fixed'].includes(field.field_type)) return false;
    if (!field.data_type || !['text', 'number', 'date'].includes(field.data_type)) return false;
    
    // セル位置のフォーマットチェック（例: A1, B10）
    if (!/^[A-Z]+\d+$/.test(field.cell_position)) return false;
  }
  
  return true;
}

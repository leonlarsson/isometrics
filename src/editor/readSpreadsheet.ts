import { parseCsv, type TSheetCell } from "#/scene/sheets";

/** One sheet of a file: its name (null for a CSV, which has one) and its rows, the header first. */
export interface ISpreadsheetSheet {
	name: string | null;
	rows: TSheetCell[][];
	/** Numbers in it are written 1.234,5 (a CSV split by semicolons, as such places save them). */
	decimalComma: boolean;
}

/** The spreadsheets read here: CSV (and TSV) as text, Excel's .xlsx with read-excel-file. */
export const SPREADSHEET_TYPES = ".csv,.tsv,.txt,.xlsx";

const isExcel = (file: File) =>
	file.name.toLowerCase().endsWith(".xlsx") ||
	file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * A spreadsheet file's sheets (data study, step 2). Excel's reader is loaded
 * only when one is picked. Throws with a message for the user when the file
 * can't be read.
 */
export const readSpreadsheet = async (file: File): Promise<ISpreadsheetSheet[]> => {
	if (file.name.toLowerCase().endsWith(".xls")) {
		throw new Error("Old Excel files (.xls) can't be read: save it as .xlsx or CSV.");
	}
	if (isExcel(file)) {
		const { default: readExcelFile } = await import("read-excel-file/browser");
		const sheets = await readExcelFile(file);
		return sheets.map(({ sheet, data }) => ({
			name: sheet,
			// Its cells are text, numbers, yes/no or dates (its types call a date `typeof Date`).
			rows: data.map((row) => row.map((cell) => cell as TSheetCell)),
			decimalComma: false,
		}));
	}
	const { rows, delimiter } = parseCsv(await file.text());
	return [{ name: null, rows, decimalComma: delimiter === ";" }];
};

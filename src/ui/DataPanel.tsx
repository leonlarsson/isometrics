import { useState } from "react";

import { useEditor } from "#/editor/store";
import { formatEntry, toDataKey } from "#/scene/format";
import type { TDataEntry } from "#/scene/schema";

import { Section } from "./fields";
import { Icon } from "./Icon";

import styles from "./Fields.module.css";

/** Values may be numbers or text; keep numbers numeric so formatting works. */
const parseValue = (raw: string): number | string => {
	const trimmed = raw.trim();
	if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}
	return raw;
};

const DataRow = ({ entry }: { entry: TDataEntry }) => {
	const upsertData = useEditor((s) => s.upsertData);
	const removeData = useEditor((s) => s.removeData);
	const [rawValue, setRawValue] = useState<string | null>(null);

	return (
		<div className={styles.dataRow}>
			<input
				className={styles.input}
				aria-label="Name"
				value={entry.label}
				placeholder="Name"
				onChange={(e) => upsertData({ ...entry, label: e.target.value })}
			/>

			<input
				className={styles.input}
				aria-label="Value"
				value={rawValue ?? String(entry.value)}
				onChange={(e) => {
					setRawValue(e.target.value);
					upsertData({ ...entry, value: parseValue(e.target.value) });
				}}
				onBlur={() => setRawValue(null)}
			/>

			<input
				className={styles.input}
				aria-label="Unit"
				value={entry.unit}
				placeholder="unit"
				onChange={(e) => upsertData({ ...entry, unit: e.target.value })}
			/>

			<button
				type="button"
				className={styles.iconButton}
				title="Remove value"
				onClick={() => removeData(entry.key)}
			>
				<Icon name="trash" size={15} />
			</button>

			<span className={styles.dataMeta}>
				<code>{entry.key}</code> · shows as <strong>{formatEntry(entry)}</strong>
			</span>
		</div>
	);
};

export const DataPanel = () => {
	const data = useEditor((s) => s.scene.data);
	const upsertData = useEditor((s) => s.upsertData);

	const addValue = () => {
		let key = toDataKey("new value");
		let n = 1;
		while (data.some((d) => d.key === key)) {
			key = `new_value_${++n}`;
		}
		upsertData({ key, label: "New value", value: 0, unit: "" });
	};

	return (
		<Section
			title="Values"
			actions={
				<button type="button" className={styles.smallButton} onClick={addValue}>
					<Icon name="plus" size={14} /> Add
				</button>
			}
		>
			<p className={styles.hint}>
				These numbers feed the labels and detail tiles. Units are added right after the value, so
				type {"“ min”"} (with a space) or {"“%”"}.
			</p>

			<div className={styles.dataHeader}>
				<span>Name</span>

				<span>Value</span>

				<span>Unit</span>
			</div>

			{data.map((entry) => (
				<DataRow key={entry.key} entry={entry} />
			))}
		</Section>
	);
};

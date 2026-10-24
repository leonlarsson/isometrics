import { useState } from "react";

import { useEditor } from "#/editor/store";
import { formatEntry, toDataKey } from "#/scene/format";
import type { TDataEntry } from "#/scene/schema";

import { Button, IconButton } from "./Button";
import { Hint, Input, Section } from "./fields";

import styles from "./DataPanel.module.css";

/** Values may be numbers or text; keep numbers numeric so formatting works. */
const parseValue = (raw: string): number | string => {
	const trimmed = raw.trim();
	if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}
	return raw;
};

/** One value: its name, then value and unit side by side, then how it reads on a card. */
const DataRow = ({ entry }: { entry: TDataEntry }) => {
	const upsertData = useEditor((s) => s.upsertData);
	const removeData = useEditor((s) => s.removeData);
	const [rawValue, setRawValue] = useState<string | null>(null);

	return (
		<li className={styles.row}>
			<div className={styles.nameRow}>
				<Input
					ariaLabel="Name"
					value={entry.label}
					placeholder="Name"
					onChange={(label) => upsertData({ ...entry, label })}
				/>

				<IconButton icon="trash" label="Remove value" onClick={() => removeData(entry.key)} />
			</div>

			<div className={styles.valueRow}>
				<Input
					ariaLabel="Value"
					value={rawValue ?? String(entry.value)}
					placeholder="Value"
					onChange={(raw) => {
						setRawValue(raw);
						upsertData({ ...entry, value: parseValue(raw) });
					}}
					onBlur={() => setRawValue(null)}
				/>

				<Input
					ariaLabel="Unit"
					value={entry.unit}
					placeholder="Unit"
					onChange={(unit) => upsertData({ ...entry, unit })}
				/>
			</div>

			<span className={styles.meta}>
				<code>{entry.key}</code> · shows as <strong>{formatEntry(entry)}</strong>
			</span>
		</li>
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
			id="data.values"
			icon="chart"
			title="Values"
			keywords="data numbers"
			actions={
				<Button size="sm" icon="plus" onClick={addValue}>
					Add
				</Button>
			}
		>
			<Hint>
				These numbers feed the labels and detail tiles. Units are added right after the value, so
				type {"“ min”"} (with a space) or {"“%”"}.
			</Hint>

			{data.length > 0 && (
				<ul className={styles.list}>
					{data.map((entry) => (
						<DataRow key={entry.key} entry={entry} />
					))}
				</ul>
			)}
		</Section>
	);
};

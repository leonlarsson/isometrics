import { SWATCHES } from "#/scene/theme";

import { Field } from "./Field";
import type { IInherit } from "./InheritAction";

import styles from "./Fields.module.css";

interface IColorFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	/** Colours usually default to the part's or theme's colour until changed. */
	inherit?: IInherit;
}

/** Colour picker with friendly preset swatches and an optional reset to default. */
export const ColorField = ({ label, value, onChange, inherit }: IColorFieldProps) => {
	return (
		<Field label={label} inherit={inherit}>
			{(id) => (
				<div className={styles.color}>
					<div className={styles.swatches}>
						{SWATCHES.map((swatch) => (
							<button
								key={swatch}
								type="button"
								className={styles.swatch}
								style={{ background: swatch }}
								aria-label={`Use ${swatch}`}
								data-active={swatch.toLowerCase() === value.toLowerCase() || undefined}
								onClick={() => onChange(swatch)}
							/>
						))}
					</div>

					<div className={styles.colorRow}>
						<input
							id={id}
							type="color"
							className={styles.colorInput}
							value={value}
							onChange={(e) => onChange(e.target.value)}
						/>

						<code className={styles.hex}>{value}</code>
					</div>
				</div>
			)}
		</Field>
	);
};

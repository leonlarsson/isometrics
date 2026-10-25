import { Popover } from "@base-ui/react/popover";

import { SWATCHES } from "#/scene/theme";

import { Icon } from "../Icon";

import { Field } from "./Field";
import type { IInherit } from "./InheritAction";

import styles from "./Fields.module.css";

interface IColorFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	/** Colours usually default to the part's or theme's colour until changed. */
	inherit?: IInherit;
	/** The value differs between the selected things (ADR-0064). */
	mixed?: boolean;
}

/**
 * A colour as one compact button (its swatch and hex code) that opens the
 * friendly preset swatches and a free colour picker in a popover.
 */
export const ColorField = ({ label, value, onChange, inherit, mixed }: IColorFieldProps) => {
	return (
		<Field label={label} inherit={inherit} mixed={mixed}>
			{(id) => (
				<Popover.Root>
					<Popover.Trigger id={id} className={styles.colorTrigger}>
						<span className={styles.colorChip} style={{ background: value }} />

						<code className={styles.hex}>{value}</code>

						<span className={styles.selectIcon}>
							<Icon name="chevronDown" size={14} />
						</span>
					</Popover.Trigger>

					<Popover.Portal>
						<Popover.Positioner
							className={styles.selectPositioner}
							side="bottom"
							align="end"
							sideOffset={4}
						>
							<Popover.Popup className={styles.colorPopup} aria-label={label}>
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

								<label className={styles.colorRow}>
									<input
										type="color"
										className={styles.colorInput}
										value={value}
										onChange={(e) => onChange(e.target.value)}
									/>

									<span>Any colour…</span>

									<code className={styles.hex}>{value}</code>
								</label>
							</Popover.Popup>
						</Popover.Positioner>
					</Popover.Portal>
				</Popover.Root>
			)}
		</Field>
	);
};

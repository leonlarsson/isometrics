import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";

import { describeColor } from "#/scene/colorNames";
import { SWATCHES } from "#/scene/theme";

import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip";

import { Field } from "./Field";
import type { TResettable } from "./InheritAction";

import styles from "./Fields.module.css";

interface IColorFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	/** The value differs between the selected things (ADR-0064). */
	mixed?: boolean;
	hint?: ReactNode;
}

/** What a colour is called: a preset's own name, else in a few words ("light orange"). */
const colorName = (hex: string) => {
	const preset = SWATCHES.find((swatch) => swatch.color.toLowerCase() === hex.toLowerCase());
	const name = preset?.name ?? describeColor(hex);
	return name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
};

/**
 * A colour as one compact button (its swatch, its name in words and its hex
 * code) that opens the friendly preset swatches, each named in a tooltip, and a
 * free colour picker in a popover. Colours are always named, not only shown:
 * not everyone can tell them apart by sight.
 */
export const ColorField = ({
	label,
	value,
	onChange,
	inherit,
	mixed,
	hint,
}: IColorFieldProps & TResettable) => {
	const name = colorName(value);
	return (
		<Field label={label} inherit={inherit} mixed={mixed} hint={hint}>
			{(id) => (
				<Popover.Root>
					<Popover.Trigger id={id} className={styles.colorTrigger}>
						<span className={styles.colorChip} style={{ background: value }} />

						{/* The name first: when the field is narrow, the hex code gives way before it does. */}
						<span className={styles.colorText}>
							{name && <span className={styles.colorName}>{name}</span>}

							<code className={styles.hex}>{value}</code>
						</span>

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
									{SWATCHES.map((swatch) => {
										const active = swatch.color.toLowerCase() === value.toLowerCase();
										return (
											<Tooltip key={swatch.color} label={swatch.name}>
												<button
													type="button"
													className={styles.swatch}
													style={{ background: swatch.color }}
													aria-label={`Use ${swatch.name.toLowerCase()} (${swatch.color})`}
													aria-pressed={active}
													data-active={active || undefined}
													onClick={() => onChange(swatch.color)}
												>
													{/* The chosen one says so with a tick, not only its ring. */}
													{active && (
														<span className={styles.swatchTick}>
															<Icon name="check" size={11} />
														</span>
													)}
												</button>
											</Tooltip>
										);
									})}
								</div>

								<label className={styles.colorRow}>
									<input
										type="color"
										className={styles.colorInput}
										value={value}
										onChange={(e) => onChange(e.target.value)}
									/>

									<span className={styles.colorRowLabel}>Any colour…</span>

									{/* The colour's name over its hex code, so both fit whole. */}
									<span className={styles.colorRowValue}>
										{name && <span>{name}</span>}

										<code className={styles.hex}>{value}</code>
									</span>
								</label>
							</Popover.Popup>
						</Popover.Positioner>
					</Popover.Portal>
				</Popover.Root>
			)}
		</Field>
	);
};

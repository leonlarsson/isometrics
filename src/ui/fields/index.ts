/*
 * The shared building blocks for every panel (ADR-0025), one file per field.
 * Each field has the same anatomy: a label row (label on the left, an optional
 * action such as "Default" on the right), then the control, then an optional
 * hint. Number labels can be dragged left and right to scrub the value.
 *
 * Controls are Base UI components (ADR-0024) styled with our tokens.
 */

export { CheckboxGroupField } from "./CheckboxGroupField";
export { ColorField } from "./ColorField";
export {
	ComboboxField,
	type IComboboxGroup,
	type IComboboxOption,
} from "./ComboboxField";
export { Field } from "./Field";
export { FieldGroup } from "./FieldGroup";
export { GroupLabel } from "./GroupLabel";
export { Hint } from "./Hint";
export type { IInherit } from "./InheritAction";
export { Input } from "./Input";
export { Kbd } from "./Kbd";
export { NumberField } from "./NumberField";
export { PeriodsField } from "./PeriodsField";
export { formatClock, type ITimePeriod } from "./periods";
export { RadioGroupField } from "./RadioGroupField";
export { SearchField } from "./SearchField";
export { Section } from "./Section";
export { SelectField } from "./SelectField";
export { SliderField } from "./SliderField";
export { type ISplitPart, SplitField } from "./SplitField";
export { SwitchField } from "./SwitchField";
export { SettingsSearchContext, useSearchMatch, useSettingsSearch } from "./settingsSearch";
export { TextField } from "./TextField";
export { VectorField } from "./VectorField";

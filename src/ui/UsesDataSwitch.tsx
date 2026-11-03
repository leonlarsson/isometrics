import { useEditor } from "#/editor/store";

import { SwitchField } from "./fields";

/**
 * Whether the world uses data (`data.enabled`, ADR-0115, ADR-0127): one switch, the same in the World
 * tab and the Data tab. A new world starts without (Reset turns it off again); the starters that
 * show data come with it on.
 */
export const UsesDataSwitch = () => {
	const enabled = useEditor((s) => s.scene.data.enabled);
	const commit = useEditor((s) => s.commit);
	const set = (next: boolean) =>
		commit((s) => {
			s.data.enabled = next;
		});
	return (
		<SwitchField
			label="Uses data"
			checked={enabled}
			onChange={set}
			inherit={{ from: "default", inherited: !enabled, onReset: () => set(false), value: "off" }}
			hint={
				enabled
					? "Things can show and follow values and tables: the Data tab, From data, values on cards. Off for a plain world to build."
					: "Off: a plain world to build, with nothing about data anywhere but here. On, add values and tables, show them on cards and let things follow them; anything it had is kept, back when this is on."
			}
		/>
	);
};

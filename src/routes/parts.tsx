import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { APP_NAME } from "#/lib/app";
import {
	hasObjectSettings,
	NO_OBJECT_SETTINGS,
	ObjectSettingsSchema,
	type TObjectSettings,
} from "#/scene/objectSettings";
import { PartsCatalogue } from "#/ui/PartsCatalogue";

interface IPartsSearch {
	part?: string;
	settings?: TObjectSettings;
}

/** `?part=` and what's been changed in its details; anything unreadable is left out. */
const readSearch = (search: Record<string, unknown>): IPartsSearch => {
	if (typeof search.part !== "string") {
		return {};
	}
	const settings = ObjectSettingsSchema.safeParse(search.settings);
	return settings.success && hasObjectSettings(settings.data)
		? { part: search.part, settings: settings.data }
		: { part: search.part };
};

// Every part you can add to a world, with its colours, lights and settings: the parts catalogue.
// `?part=<kind>` opens one, `&settings=` with what's been changed in it.
export const Route = createFileRoute("/parts")({
	ssr: false,
	validateSearch: readSearch,
	head: () => ({ meta: [{ title: `Parts · ${APP_NAME}` }] }),
	component: Parts,
});

// Route files keep `Route` first; the hoisted function declaration makes that possible (ADR-0015).
function Parts() {
	const { part, settings } = Route.useSearch();
	const navigate = useNavigate({ from: "/parts" });
	return (
		<PartsCatalogue
			openKind={part ?? null}
			onOpen={(kind) => navigate({ search: kind ? { part: kind } : {}, replace: true })}
			settings={settings ?? NO_OBJECT_SETTINGS}
			onSettingsChange={(next) =>
				navigate({
					search: ({ part: kind }) =>
						hasObjectSettings(next) ? { part: kind, settings: next } : { part: kind },
					replace: true,
				})
			}
		/>
	);
}

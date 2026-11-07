import { SoftShadows } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { lazy, memo, Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useSceneHours, useSceneHoursSeen, useSceneNight } from "#/editor/dayClock";
import { drawsEffects, useGraphics } from "#/editor/graphics";
import { usePreferences } from "#/editor/preferences";
import { drawnModeOf, isToggleClick, useEditor } from "#/editor/store";
import { useEntity } from "#/editor/useEntity";
import { ALONE, BOXED, LIST_HOVERED, SELECTED, useEntityFlags } from "#/editor/useEntityFlags";
import { usePalette, useThemePalette } from "#/editor/useTheme";
import { areaWeathersNow, mostAnywhere, weatherNow } from "#/editor/weather";
import { useWorldData } from "#/editor/worldData";
import { darknessSeenBy, hourSeenBy } from "#/parts/lightModel";
import { entityAsDrawn, valuesOfEntity } from "#/parts/propData";
import { getPart, resolveProps } from "#/parts/registry";
import { usesDataBindings } from "#/scene/dataBindings";
import { type IRoadNetwork, roadNetworkOf, standsOnOwnPillars } from "#/scene/junctions";
import { drivesAcrossNetwork } from "#/scene/network";
import { isPrefabKind, type TEntity, type TScene } from "#/scene/schema";
import { sunAt } from "#/scene/sun";

import { AreaHandles } from "./AreaHandles";
import { AreaMesh } from "./AreaMesh";
import { AreaWeather } from "./AreaWeather";
import { BoxSelect } from "./BoxSelect";
import { CameraControls } from "./CameraControls";
import { CameraFlight } from "./CameraFlight";
import { CameraFollow } from "./CameraFollow";
import { CameraMemory } from "./CameraMemory";
import { CameraReadout } from "./CameraReadout";
import { CameraRig, FieldOfViewFollow, ProjectionSwitch } from "./CameraRig";
import { Clay } from "./Clay";
import { Clouds } from "./Clouds";
import { DistanceHaze } from "./DistanceHaze";
import { EntityNode, type IEntityWorld } from "./EntityNode";
import { FenceHandles } from "./FenceHandles";
import { FenceMesh } from "./FenceMesh";
import { Ground } from "./Ground";
import { GroundMenuMarker } from "./GroundMenuMarker";
import { GroupGizmo } from "./GroupGizmo";
import { HoverHighlight } from "./HoverHighlight";
import { InstancedParts } from "./InstancedParts";
import { InstantResize } from "./InstantResize";
import { JunctionBodies } from "./JunctionMesh";
import { KeyboardCamera } from "./KeyboardCamera";
import { KeyboardTransform } from "./KeyboardTransform";
import { LabelProjector } from "./LabelProjector";
import { MotionClockStep } from "./motionClock";
import { PaintTool } from "./PaintTool";
import { PlacementPreview } from "./PlacementPreview";
import { PointerSpot } from "./PointerSpot";
import { RealLights } from "./RealLights";
import { RoadDrawTool } from "./RoadDrawTool";
import { RoadHandles } from "./RoadHandles";
import { RoadMesh } from "./RoadMesh";
import { RouteHighlight } from "./RouteHighlight";
import { SceneLights } from "./SceneLights";
import { SkyDome } from "./SkyDome";
import { StillRender } from "./StillRender";
import { useTiltShiftShown } from "./TiltShift";
import { GizmoFirst } from "./TransformGizmo";
import { Turntable } from "./Turntable";
import { TrafficStep } from "./traffic";
import { ViewpointMarkers } from "./ViewpointMarkers";
import { ViewpointTour } from "./ViewpointTour";
import { ViewCursor } from "./viewCursor";
import { WakeFieldStep } from "./WakeField";
import { Weather, WeatherShading } from "./Weather";
import { Wireframe } from "./Wireframe";
import { WorkshopMarker } from "./WorkshopMarker";
import { WorldReady } from "./WorldReady";
import { watchForLostDrawing } from "./webgl";

// The effects composer and its libraries load only once a graphics setting needs them (ADR-0072).
const Effects = lazy(() => import("./Effects").then((module) => ({ default: module.Effects })));

/**
 * Shader errors checked in development only: three asks the GPU process for each new shader's
 * compile and link logs and waits for the answers, behind whatever the GPU has queued
 * (PERFORMANCE.md). A shader that fails draws nothing either way; only the console's report is lost.
 */
const ShaderChecks = () => {
	const gl = useThree((s) => s.gl);
	useLayoutEffect(() => {
		gl.debug.checkShaderErrors = import.meta.env.DEV;
	}, [gl]);
	return null;
};

/** Says when the view's WebGL context is lost, for the bar that offers to reload (ADR-0145). */
const LostDrawingWatch = () => {
	const canvas = useThree((s) => s.gl.domElement);
	useEffect(() => watchForLostDrawing(canvas), [canvas]);
	return null;
};

const Lights = () => {
	const palette = usePalette();
	const ground = useEditor((s) => s.scene.ground);
	const lighting = useEditor((s) => s.scene.lighting);
	const shadowMapSize = useGraphics().shadowMapSize;
	// No shadows in wireframe, unless a still picture renders (ADR-0084).
	const rendering = useEditor((s) => s.stillRender !== null);
	const wireframe = usePreferences().showWireframe && !rendering;
	return (
		<SceneLights
			ground={ground}
			palette={palette}
			lighting={lighting}
			followView
			shadowMapSize={shadowMapSize}
			castsShadows={!wireframe}
		/>
	);
};

/** What objects share, read once in Entities, plus what EntityById picks out of it for its own. */
interface IEntitiesShared {
	/** How dark it is in the world (`palette.night`). */
	night: number;
	/** What every object draws with, at the darkness its lights see (`darknessSeenBy`). */
	worldAt: (night: number) => IEntityWorld;
	roads: TScene["roads"];
	/** The roads and junctions as a network (ADR-0136): vehicles on a road with a junction drive on. */
	network: IRoadNetwork;
	/** The world's traffic settings: whether vehicles drive through junctions, unless overridden. */
	traffic: TScene["traffic"];
	data: TScene["data"];
}

/** Whether an object has a light on a schedule (or a prefab, a piece's): only those follow the world's hour. */
const followsTheHour = (entity: TEntity) =>
	(typeof entity.lights === "object" &&
		Object.values(entity.lights).some((light) => light.whenOn === "schedule")) ||
	(getPart(entity.kind)?.followsTheHour ?? false);

/** Whether an object shows values or has settings that follow them: only those follow the data. */
const followsData = (entity: TEntity) => {
	const part = getPart(entity.kind);
	return (
		(part?.fields.some((field) => field.type === "dataKey") ?? false) ||
		(part?.readsData ?? false) ||
		usesDataBindings(entity)
	);
};

/** Whether an object turns with the sun (solar panels tracking it): those follow the hour too. */
const followsTheSun = (entity: TEntity) => {
	const part = getPart(entity.kind);
	return part?.followsTheSun?.(resolveProps(part, entity.props)) ?? false;
};

type TEntityNodeProps = Parameters<typeof EntityNode>[0];

/**
 * An object with a light on a schedule: it alone follows the world's hour, which steps often, and
 * is drawn again only when one of its lights switches or ramps (a prefab's pieces' lights: at every
 * step, as the pieces see it).
 */
const EntityWithHour = (props: Omit<TEntityNodeProps, "hour">) => {
	const part = props.design ? undefined : getPart(props.entity.kind);
	const hour = useSceneHoursSeen((hours) =>
		part ? hourSeenBy(part, props.entity, hours, props.data) : hours,
	);
	return <EntityNode {...props} hour={hour} />;
};

/** An object that turns with the sun: the hour, and where the sun is at it. */
const EntityWithSun = (props: Omit<TEntityNodeProps, "hour" | "sun">) => {
	const hour = useSceneHours();
	const sunAzimuth = useEditor((s) => s.scene.lighting.sunAzimuth);
	const sunElevation = useEditor((s) => s.scene.lighting.sunElevation);
	return <EntityNode {...props} hour={hour} sun={sunAt({ sunAzimuth, sunElevation }, hour)} />;
};

/**
 * One object: drawn again when it changes, and otherwise only when something that concerns it
 * does. It hands EntityNode its own road, flags and (if it follows them) the data and the hour, so
 * the node's props stay the same when only others' do.
 */
const EntityById = ({ id, shared }: { id: string; shared: IEntitiesShared }) => {
	const entity = useEntity(id);
	// Selected, boxed, hovered in the outliner: told only when its own change (a click concerns two).
	const flags = useEntityFlags(id);
	// A prefab's copy draws again when its design changes (ADR-0134), though the copy itself didn't.
	const design = useEditor((s) =>
		entity && isPrefabKind(entity.kind)
			? s.scene.prefabs.find((prefab) => prefab.id === entity.kind)
			: undefined,
	);
	if (!entity) {
		return null;
	}
	const roadId = entity.follow?.roadId;
	const road = roadId ? (shared.roads.find((r) => r.id === roadId) ?? null) : null;
	const Node = followsTheSun(entity)
		? EntityWithSun
		: followsTheHour(entity)
			? EntityWithHour
			: EntityNode;
	// What it reads: the world's values and its row's columns (ADR-0108); drawn with its sizes and
	// props as data sets them (ADR-0109).
	const data = followsData(entity) ? valuesOfEntity(entity, shared.data) : undefined;
	const drawn = entityAsDrawn(entity, data);
	// As dusk falls, only objects whose lights change are drawn again: the others see the darkness
	// they saw before (PERFORMANCE.md). A prefab's pieces have lights of their own: it sees it all.
	const part = getPart(entity.kind);
	const night = design ? shared.night : part ? darknessSeenBy(part, drawn, shared.night) : 0;
	return (
		<Node
			entity={drawn}
			world={shared.worldAt(night)}
			road={road}
			network={
				road && drivesAcrossNetwork(shared.network, road, shared.traffic, entity.follow)
					? shared.network
					: null
			}
			data={data}
			hour={null}
			design={design}
			selected={(flags & SELECTED) !== 0}
			alone={(flags & ALONE) !== 0}
			boxed={(flags & BOXED) !== 0}
			listHovered={(flags & LIST_HOVERED) !== 0}
		/>
	);
};

/** The objects' world at each darkness they see, each made once (so objects that see the same skip). */
const worldsAt = (byDay: IEntityWorld) => {
	const made = new Map<number, IEntityWorld>([[0, byDay]]);
	return (night: number) => {
		let world = made.get(night);
		if (!world) {
			world = { ...byDay, palette: { ...byDay.palette, night } };
			made.set(night, world);
		}
		return world;
	};
};

/** Objects' ids, once per objects list (lists are replaced, never changed), not on every change. */
const idsByList = new WeakMap<readonly TEntity[], readonly string[]>();
const idsOf = (entities: readonly TEntity[]) => {
	let ids = idsByList.get(entities);
	if (!ids) {
		ids = entities.map((entity) => entity.id);
		idsByList.set(entities, ids);
	}
	return ids;
};

/**
 * Objects are drawn in groups, each object always in the same one (by its id), so a change of
 * darkness reaches them a group a frame (useDarknessWave): a dusk or a mood relighting a whole town
 * was one commit of every lit object, a hitch of tens of milliseconds (PERFORMANCE.md). An object
 * never moves to another group as others come and go, which would mount it afresh.
 */
const ENTITY_GROUPS = 16;

const groupOf = (id: string) => {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % ENTITY_GROUPS;
};

const sameIds = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((id, i) => id === b[i]);

/** The groups last made, so a group whose objects stay the same keeps its list (and isn't drawn again). */
let lastGroups: readonly (readonly string[])[] = [];
const groupsByIds = new WeakMap<readonly string[], readonly (readonly string[])[]>();

/** Each group's ids, in the world's order: once per ids list, the lists of unchanged groups kept. */
const groupIds = (ids: readonly string[]) => {
	let groups = groupsByIds.get(ids);
	if (!groups) {
		const made: string[][] = Array.from({ length: ENTITY_GROUPS }, () => []);
		for (const id of ids) {
			made[groupOf(id)].push(id);
		}
		const before = lastGroups;
		groups = made.map((group, i) => (before[i] && sameIds(before[i], group) ? before[i] : group));
		groupsByIds.set(ids, groups);
		lastGroups = groups;
	}
	return groups;
};

/**
 * The darkness each group of objects sees: when it changes, it reaches the groups one a frame, so
 * relighting a whole town is drawn over a few frames rather than in one.
 */
const useDarknessWave = (night: number, groups: readonly (readonly string[])[]) => {
	const [seen, setSeen] = useState<readonly number[]>(() => groups.map(() => night));
	useEffect(() => {
		let next = 0;
		let frame = 0;
		// As they were when the darkness changed (a change while a wave runs starts it again).
		const before = seen;
		const step = () => {
			// Groups with no objects, or already there, take no frame of their own.
			while (next < groups.length && (groups[next].length === 0 || before[next] === night)) {
				next += 1;
			}
			if (next >= groups.length) {
				return;
			}
			const at = next;
			setSeen((now) => (now[at] === night ? now : now.map((each, i) => (i === at ? night : each))));
			next += 1;
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	}, [night]);
	return seen;
};

/** One group of objects (ENTITY_GROUPS), drawn again only when its ids or what it shares change. */
const EntityGroup = memo(({ ids, shared }: { ids: readonly string[]; shared: IEntitiesShared }) =>
	ids.map((id) => <EntityById key={id} id={id} shared={shared} />),
);

/**
 * Every object, with what they all read from the editor read once here (ADR-0092): thousands of
 * objects each subscribing to a dozen things ran tens of thousands of selectors on every change. A
 * change to one object (a drag, every frame) renders only that one; a change to the selection or
 * the world renders the list, and each object's node only if its own props changed.
 */
const Entities = memo(() => {
	const ids = useEditor(useShallow((s) => idsOf(s.scene.entities)));
	const groups = groupIds(ids);
	// The theme's colours, and how dark it is apart: each object sees the darkness its lights do,
	// reaching the groups one a frame.
	const palette = useThemePalette();
	const nights = useDarknessWave(useSceneNight(), groups);
	const graphics = useGraphics();
	const settings = useEditor(
		useShallow((s) => ({
			mode: drawnModeOf(s),
			unboxing: s.boxDrag?.removing ?? false,
			playing: s.playing,
			ground: s.scene.ground,
			driving: s.scene.traffic.drivingSide,
			sceneTurns: s.scene.traffic.turnStyle,
			sceneLeans: s.scene.traffic.leansInTurns,
			drawing: s.drawing !== null,
		})),
	);
	const data = useWorldData();
	const picked = useEditor(
		useShallow((s) => ({
			roads: s.scene.roads,
			network: roadNetworkOf(s.scene.roads, s.scene.junctions),
			traffic: s.scene.traffic,
			data,
		})),
	);
	const worldAt = useMemo(
		() => worldsAt({ ...settings, palette, graphics }),
		[settings, palette, graphics],
	);
	// What's shared at each darkness, made once each, so a group whose darkness stays isn't drawn again.
	const sharedAt = useMemo(() => {
		const made = new Map<number, IEntitiesShared>();
		return (night: number) => {
			let shared = made.get(night);
			if (!shared) {
				shared = { ...picked, night, worldAt };
				made.set(night, shared);
			}
			return shared;
		};
	}, [picked, worldAt]);
	return groups.map((group, i) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: the groups are fixed, each object always in its own
		<EntityGroup key={i} ids={group} shared={sharedAt(nights[i] ?? 0)} />
	));
});

/**
 * Objects standing still cost nothing per frame (ADR-0092): three would walk every object in the
 * scene each frame to work out world matrices (tens of thousands of nodes in a painted world), so
 * the scene doesn't, and just before each render only what may have moved is brought up to date:
 * everything but the objects that settled their own matrices (render/EntityNode's settleMatrices).
 */
const StillScene = () => {
	const scene = useThree((s) => s.scene);
	useLayoutEffect(() => {
		scene.updateMatrix();
		scene.matrixAutoUpdate = false;
		scene.matrixWorldAutoUpdate = false;
		const before = scene.onBeforeRender;
		scene.onBeforeRender = (...args) => {
			for (const child of scene.children) {
				if (!child.userData.settled) {
					child.updateMatrixWorld();
				}
			}
			before.apply(scene, args);
		};
		return () => {
			scene.matrixAutoUpdate = true;
			scene.matrixWorldAutoUpdate = true;
			scene.onBeforeRender = before;
		};
	}, [scene]);
	return null;
};

/** The roads, cut back where they meet at junctions, and the junctions' own surfaces (ADR-0136). */
const Roads = () => {
	const roads = useEditor((s) => s.scene.roads);
	const junctions = useEditor((s) => s.scene.junctions);
	// The theme's colours: junctions don't change as it gets dark.
	const palette = useThemePalette();
	const data = useWorldData();
	const network = roadNetworkOf(roads, junctions);

	return (
		<>
			{/* Hidden roads keep their index: it's their draw layer. */}
			{roads.map((road, index) => {
				if (road.isHidden) {
					return null;
				}
				const trims = network.drawTrimsOf(road.id);
				return (
					<RoadMesh
						key={road.id}
						road={road}
						layer={index}
						trimStart={trims.start}
						trimEnd={trims.end}
						bareStart={standsOnOwnPillars(network.junctionAt(road.id, "start"))}
						bareEnd={standsOnOwnPillars(network.junctionAt(road.id, "end"))}
					/>
				);
			})}

			<JunctionBodies roads={roads} junctions={junctions} palette={palette} data={data} />
		</>
	);
};

export const Viewport = () => {
	const areas = useEditor((s) => s.scene.areas);
	const fences = useEditor((s) => s.scene.fences);
	const graphics = useGraphics();
	// A still picture renders without wireframe, at its own pixel ratio (ADR-0084).
	const rendering = useEditor((s) => s.stillRender !== null);
	const stillPixelRatio = useEditor((s) => s.stillRender?.pixelRatio ?? null);
	const wireframe = usePreferences().showWireframe && !rendering;
	// Clay keeps the light and shadows, but not snow and wet ground, which colour things.
	const clay = usePreferences().showClay && !rendering;
	const tiltShiftShown = useTiltShiftShown();
	// Wireframe draws as plainly as it can: no effects, tilt-shift included.
	const composed = !wireframe && (drawsEffects(graphics) || tiltShiftShown);
	// What the weather draws (ADR-0102): each piece only while its amount is above nothing, the
	// world's or an area's own (ADR-0151).
	const worldData = useWorldData();
	const data = worldData.values;
	const weather = useEditor(
		useShallow((s) => {
			const now = weatherNow(s.scene.weather, data);
			const areas = areaWeathersNow(s.scene.areas, worldData);
			const somewhere = (amount: (weather: typeof now) => number) =>
				mostAnywhere(now, areas, amount) > 0;
			return {
				rain: somewhere((w) => w.rain),
				snow: somewhere((w) => w.snow),
				splashes: somewhere((w) => (w.showsSplashes ? w.rain : 0)),
				lightning: now.lightning > 0,
				shading: now.wetness > 0 || now.snowCover > 0 || areas.length > 0,
				fog: now.fog > 0 || now.haze > 0,
				local: areas.length > 0,
			};
		}),
	);

	return (
		<Canvas
			shadows="percentage"
			orthographic
			dpr={stillPixelRatio ?? [1, graphics.maxPixelDensity]}
			camera={{ position: [100, 90, 100], zoom: 18, near: 0.1, far: 1000 }}
			onPointerMissed={(event) => {
				// Only a left click on nothing deselects; a right-click is the start of an orbit. Shift or
				// Ctrl, which add to the selection, leave it as it is.
				if (event.button === 0 && !isToggleClick(event)) {
					useEditor.getState().clearSelection();
				}
			}}
		>
			<LostDrawingWatch />

			<ShaderChecks />

			<StillScene />

			<Lights />

			<SkyDome />

			<Clouds />

			<Ground />

			{/* Hidden items keep their index: it's their draw layer. */}
			{areas.map((area, index) =>
				area.isHidden ? null : <AreaMesh key={area.id} area={area} layer={index} />,
			)}

			<AreaHandles />

			<Entities />

			<InstancedParts />

			<Roads />

			<RoadHandles />

			{fences.map((fence) => (fence.isHidden ? null : <FenceMesh key={fence.id} fence={fence} />))}

			<FenceHandles />

			<GroupGizmo />

			<RoadDrawTool />

			<PlacementPreview />

			<RouteHighlight />

			<GroundMenuMarker />

			{/* In the Workshop, where the prefab's base and front are (ADR-0134). */}
			<WorkshopMarker />

			<HoverHighlight />

			<CameraControls />

			<GizmoFirst />

			<KeyboardTransform />

			<BoxSelect />

			<PaintTool />

			<PointerSpot />

			<ViewCursor />

			<CameraRig />

			<ProjectionSwitch />

			<FieldOfViewFollow />

			<CameraFlight />

			<CameraMemory />

			<KeyboardCamera />

			<Turntable />

			<ViewpointTour />

			{composed && (
				<Suspense fallback={null}>
					<Effects graphics={graphics} />
				</Suspense>
			)}

			{/* Soft shadow edges; a small light, so long shadows stay. */}
			{graphics.useSoftShadows && <SoftShadows size={8} samples={16} focus={0.6} />}

			{graphics.realLightCount > 0 && <RealLights count={graphics.realLightCount} />}

			{(graphics.showDistanceHaze || weather.fog) && (
				<DistanceHaze viewerHaze={graphics.showDistanceHaze} />
			)}

			<Weather
				rain={weather.rain}
				snow={weather.snow}
				splashes={weather.splashes}
				lightning={weather.lightning}
				local={weather.local}
			/>

			<WeatherShading on={weather.shading && !wireframe && !clay} local={weather.local} />

			{weather.local && <AreaWeather />}

			{/* The boats' waves, which only reflective water shows (ADR-0081). */}
			{graphics.boatWakes === "foamAndWaves" && graphics.showWaterReflections && <WakeFieldStep />}

			{wireframe && <Wireframe />}

			{clay && !wireframe && <Clay />}

			<CameraReadout />

			<ViewpointMarkers />

			<MotionClockStep />

			<TrafficStep />

			<StillRender />

			{/* After the world's objects, so its effect runs once they're mounted (ADR-0100). */}
			<WorldReady waitsForEffects={composed} />

			<CameraFollow />

			<LabelProjector />

			<InstantResize />
		</Canvas>
	);
};

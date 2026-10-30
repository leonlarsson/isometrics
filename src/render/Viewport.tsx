import { SoftShadows } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { lazy, memo, Suspense, useLayoutEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { useSceneHours } from "#/editor/dayClock";
import type { ISceneItem } from "#/editor/framing";
import { drawsEffects, useGraphics } from "#/editor/graphics";
import { usePreferences } from "#/editor/preferences";
import { drawnModeOf, includesItem, isToggleClick, useEditor } from "#/editor/store";
import { useEntity } from "#/editor/useEntity";
import { usePalette } from "#/editor/useTheme";
import { weatherNow } from "#/editor/weather";
import { getPart, resolveProps } from "#/parts/registry";
import { usesDataBindings } from "#/scene/dataBindings";
import type { TEntity, TScene } from "#/scene/schema";
import { sunAt } from "#/scene/sun";

import { AreaHandles } from "./AreaHandles";
import { AreaMesh } from "./AreaMesh";
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
import { ViewCursor } from "./viewCursor";
import { WakeFieldStep } from "./WakeField";
import { Weather, WeatherShading } from "./Weather";
import { Wireframe } from "./Wireframe";
import { WorldReady } from "./WorldReady";

// The effects composer and its libraries load only once a graphics setting needs them (ADR-0072).
const Effects = lazy(() => import("./Effects").then((module) => ({ default: module.Effects })));

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

const NO_ITEMS: ISceneItem[] = [];

/** What objects share, read once in Entities, plus what EntityById picks out of it for its own. */
interface IEntitiesShared {
	world: IEntityWorld;
	roads: TScene["roads"];
	data: TScene["data"];
	selectedItems: readonly ISceneItem[];
	selectedId: string | null;
	boxedItems: readonly ISceneItem[];
	hovered: ISceneItem | null;
}

/** Whether an object has a light on a schedule: only those follow the world's hour. */
const followsTheHour = (entity: TEntity) =>
	typeof entity.lights === "object" &&
	Object.values(entity.lights).some((light) => light.whenOn === "schedule");

/** Whether an object shows values or has settings that follow them: only those follow the data. */
const followsData = (entity: TEntity) =>
	(getPart(entity.kind)?.fields.some((field) => field.type === "dataKey") ?? false) ||
	usesDataBindings(entity);

/** Whether an object turns with the sun (solar panels tracking it): those follow the hour too. */
const followsTheSun = (entity: TEntity) => {
	const part = getPart(entity.kind);
	return part?.followsTheSun?.(resolveProps(part, entity.props)) ?? false;
};

type TEntityNodeProps = Parameters<typeof EntityNode>[0];

/** An object with a light on a schedule: it alone follows the world's hour, which steps often. */
const EntityWithHour = (props: Omit<TEntityNodeProps, "hour">) => (
	<EntityNode {...props} hour={useSceneHours()} />
);

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
	if (!entity) {
		return null;
	}
	const roadId = entity.follow?.roadId;
	const Node = followsTheSun(entity)
		? EntityWithSun
		: followsTheHour(entity)
			? EntityWithHour
			: EntityNode;
	return (
		<Node
			entity={entity}
			world={shared.world}
			road={roadId ? (shared.roads.find((road) => road.id === roadId) ?? null) : null}
			data={followsData(entity) ? shared.data : undefined}
			hour={null}
			selected={includesItem(shared.selectedItems, "entity", id)}
			alone={shared.selectedId === id && shared.selectedItems.length === 1}
			boxed={includesItem(shared.boxedItems, "entity", id)}
			listHovered={shared.hovered?.kind === "entity" && shared.hovered.id === id}
		/>
	);
};

/**
 * Every object, with what they all read from the editor read once here (ADR-0092): thousands of
 * objects each subscribing to a dozen things ran tens of thousands of selectors on every change. A
 * change to one object (a drag, every frame) renders only that one; a change to the selection or
 * the world renders the list, and each object's node only if its own props changed.
 */
const Entities = memo(() => {
	const ids = useEditor(useShallow((s) => s.scene.entities.map((entity) => entity.id)));
	const palette = usePalette();
	const graphics = useGraphics();
	const settings = useEditor(
		useShallow((s) => ({
			mode: drawnModeOf(s),
			unboxing: s.boxDrag?.removing ?? false,
			playing: s.playing,
			ground: s.scene.ground,
			driving: s.scene.drivingSide,
			sceneTurns: s.scene.turnStyle,
			sceneLeans: s.scene.leansInTurns,
			drawing: s.drawing !== null,
		})),
	);
	const picked = useEditor(
		useShallow((s) => ({
			roads: s.scene.roads,
			data: s.scene.data,
			selectedItems: s.selectedItems,
			selectedId: s.selectedId,
			boxedItems: s.boxDrag?.items ?? NO_ITEMS,
			hovered: s.hovered,
		})),
	);
	const world = useMemo(
		(): IEntityWorld => ({ ...settings, palette, graphics }),
		[settings, palette, graphics],
	);
	const shared = useMemo((): IEntitiesShared => ({ ...picked, world }), [picked, world]);
	return ids.map((id) => <EntityById key={id} id={id} shared={shared} />);
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

export const Viewport = () => {
	const roads = useEditor((s) => s.scene.roads);
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
	// What the weather draws (ADR-0102): each piece only while its amount is above nothing.
	const weather = useEditor(
		useShallow((s) => {
			const now = weatherNow(s.scene.weather, s.scene.data);
			return {
				rain: now.rain > 0,
				snow: now.snow > 0,
				splashes: now.rain > 0 && now.showsSplashes,
				lightning: now.lightning > 0,
				shading: now.wetness > 0 || now.snowCover > 0,
				fog: now.fog > 0 || now.haze > 0,
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
			<StillScene />

			<Lights />

			<SkyDome />

			<Clouds />

			<Ground />

			{/* Hidden items keep their index: it's their draw layer. */}
			{areas.map((area, index) =>
				area.hidden ? null : <AreaMesh key={area.id} area={area} layer={index} />,
			)}

			<AreaHandles />

			<Entities />

			<InstancedParts />

			{roads.map((road, index) =>
				road.hidden ? null : <RoadMesh key={road.id} road={road} layer={index} />,
			)}

			<RoadHandles />

			{fences.map((fence) => (fence.hidden ? null : <FenceMesh key={fence.id} fence={fence} />))}

			<FenceHandles />

			<GroupGizmo />

			<RoadDrawTool />

			<PlacementPreview />

			<RouteHighlight />

			<GroundMenuMarker />

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
			/>

			<WeatherShading on={weather.shading && !wireframe && !clay} />

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

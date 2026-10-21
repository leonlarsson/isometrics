import { Line } from "@react-three/drei";
import { useMemo } from "react";

import { usePalette } from "#/editor/useTheme";
import type { TScenePath } from "#/scene/schema";

export const PathLine = ({ path }: { path: TScenePath }) => {
	const palette = usePalette();
	const points = useMemo(() => {
		const pts = path.points.map(([x, z]) => [x, 0.09, z] as [number, number, number]);
		if (path.closed && pts.length > 2) {
			pts.push(pts[0]);
		}
		return pts;
	}, [path.points, path.closed]);

	return (
		<Line
			points={points}
			color={path.color ?? palette.selection}
			lineWidth={2}
			dashed
			dashSize={0.35}
			gapSize={0.25}
		/>
	);
};

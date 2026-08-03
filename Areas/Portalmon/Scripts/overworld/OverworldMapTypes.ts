import { DialogueSequence } from "../OverworldDialogue";

export type WalkDirection = "up" | "down" | "left" | "right";
export type OverworldMapId = "town" | "gym1";

export interface MapPoint
{
	x: number;
	y: number;
}

export interface MapCollisionRect
{
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
}

export interface MapCollisionPoint extends MapPoint
{
	label: string;
}

export interface MapEncounterZone extends MapPoint
{
	width: number;
	height: number;
}

export interface MapObjectDef
{
	atlasIndex: number;
	position: MapPoint;
	width: number;
	height: number;
	offsetX?: number;
	offsetY?: number;
}

export interface MapWarpDef
{
	position: MapPoint;
	targetMapId: OverworldMapId;
	targetSpawnId: string;
}

/** A non-triggering map arrival point, identified only within its own map. */
export interface MapSpawnDef
{
	id: string;
	position: MapPoint;
	facing: WalkDirection;
}

export interface MapTilesetDef
{
	imagePath: string;
	firstGid: number;
	columns: number;
}

export interface MapPortalDef
{
	portalId: number;
	position: MapPoint;
	/** When true, arrive one tile beyond this endpoint in the incoming direction. */
	directionalExit: boolean;
}

/** A reusable map destination for recovery, scripted movement, and future interiors. */
export interface MapTeleportDestination
{
	mapId: OverworldMapId;
	position: MapPoint;
	facing: WalkDirection;
}

export interface MapGymInteractionDef
{
	position: MapPoint;
	kind: "gym";
	/** Stable physical gym slot; leader data can change independently. */
	gymSlot: number;
}

export interface MapCenterInteractionDef
{
	position: MapPoint;
	kind: "center";
}

export type MapInteractionDef = MapGymInteractionDef | MapCenterInteractionDef;

export interface MapNpcDef
{
	id: string;
	name: string;
	position: MapPoint;
	initialFacing: WalkDirection;
	/** Omit when the actor is already drawn into the map's background image. */
	spritePath?: string;
	/** Zero-based tile in a single-row 16×16 NPC sprite sheet. */
	spriteTileIndex?: number;
	dialogue: DialogueSequence;
}

export interface OverworldMapDef
{
	id: OverworldMapId;
	name: string;
	width: number;
	height: number;
	backgroundColor: string;
	defaultSpawn: MapPoint;
	defaultFacing: WalkDirection;
	statusText: string;
	/** Static precomposed map image. When set, tileAt is not used. */
	backgroundImagePath?: string;
	/** Atlas tile lookup for legacy/small maps such as interiors. */
	tileAt?: (x: number, y: number) => number;
	/** TMX tile layers, rendered in source order when a precomposed image is unavailable. */
	tileLayers?: number[][];
	tileset?: MapTilesetDef;
	objects: MapObjectDef[];
	collisionRects: MapCollisionRect[];
	collisionPoints: MapCollisionPoint[];
	/** Tiles that may start a random wild encounter after a completed movement step. */
	encounterZones: MapEncounterZone[];
	/** Tiles that continue movement in the same direction after landing. */
	iceTiles: MapPoint[];
	/** Paired, same-map portals. Each portalId must have exactly two endpoints. */
	portals: MapPortalDef[];
	spawns: MapSpawnDef[];
	warps: MapWarpDef[];
	interactions: MapInteractionDef[];
	npcs: MapNpcDef[];
}

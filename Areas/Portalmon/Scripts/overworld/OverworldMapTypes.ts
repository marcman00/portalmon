import { DialogueSequence } from "../OverworldDialogue";

export type WalkDirection = "up" | "down" | "left" | "right";
export type OverworldMapId = "town" | "gym1" | "gym2" | "gym3" | "lab";

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
	tileCount: number;
	columns: number;
	tileWidth?: number;
	tileHeight?: number;
	spacing: number;
	margin: number;
}

export interface MapPortalDef
{
	portalId: number;
	position: MapPoint;
	/** When true, arrive one tile beyond this endpoint in the incoming direction. */
	directionalExit: boolean;
}

/** A Tiled Actables object. Trainers are resolved from TrainerDefs by ID. */
export interface MapActableDef
{
	id: number;
	position: MapPoint;
	facing: WalkDirection;
	name?: string;
	message?: string;
	trainerId?: string;
	/** Opaque controller-owned interaction identifier authored in Tiled. */
	scriptId?: string;
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
	/** When present, TALK starts this trainer's configured battle. */
	trainerId?: string;
	/** Opaque controller-owned interaction identifier authored in Tiled. */
	scriptId?: string;
	/** Dialogue shown after this trainer has been defeated. */
	afterBattleDialogue?: DialogueSequence;
	/** Omit when the actor is already drawn into the map's background image. */
	spritePath?: string;
	/** Zero-based, row-major tile in a 16×16 NPC sprite sheet. */
	spriteTileIndex?: number;
	/** Transparent pixels separating sprite-sheet rows. */
	spriteRowGap?: number;
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
	/** TMX tilesets, in the same order they are declared by the source map. */
	tilesets?: MapTilesetDef[];
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

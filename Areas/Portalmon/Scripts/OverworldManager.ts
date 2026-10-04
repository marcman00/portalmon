import { OverworldDialogue } from "./OverworldDialogue";
import { perfProbe } from "./PerfProbe";
import {
	MapInteractionDef,
	MapNpcDef,
	MapPoint,
	MapTeleportDestination,
	MapWarpDef,
	OverworldMapDef,
	OverworldMapId,
	WalkDirection,
} from "./overworld/OverworldMapTypes";
import { WORLD_MAPS } from "./overworld/WorldMapRegistry";

export type { WalkDirection } from "./overworld/OverworldMapTypes";

interface MoveState
{
	from: MapPoint;
	to: MapPoint;
	direction: WalkDirection;
	startedAt: number;
}

interface SpriteFrameRect
{
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * A map's tile layers flattened into a single canvas. Tiles taller or wider
 * than one cell hang outside the logical map bounds, so the canvas is padded
 * and the padding is subtracted again when the viewport is blitted.
 */
interface PrerenderedMap
{
	canvas: HTMLCanvasElement;
	overdrawTop: number;
	overdrawRight: number;
}

const TILE_SIZE = 16;
const VIEWPORT_WIDTH = 240;
const VIEWPORT_HEIGHT = 160;
const MOVE_DURATION_MS = 135;
/**
 * While the overworld screen is not the active screen there is nothing to draw,
 * so the loop backs off to a slow poll instead of re-arming at display rate.
 * A hidden 60fps loop is invisible in the standalone harness but competes with
 * everything else on a real host page.
 */
const IDLE_POLL_MS = 200;
const PLAYER_PIXEL_SCALE = 1;
/** Medium encounter rate, evaluated only after a completed step in a Wild zone. */
const WILD_ENCOUNTER_CHANCE = 0.12;
const WILD_ENCOUNTER_COOLDOWN_STEPS = 3;

const DIRECTION_DELTAS: Record<WalkDirection, MapPoint> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};

const DIRECTION_ROWS: Record<WalkDirection, number> = {
	down: 0,
	left: 1,
	right: 2,
	up: 3,
};

// Atlas uses two 16x16 frames per direction. Rows are ordered down, left,
// right, up to match DIRECTION_ROWS; every frame shares the same foot anchor.
const PLAYER_FRAME_RECTS: Record<WalkDirection, SpriteFrameRect[]> = {
	down: [
		{ x: 0, y: 0, width: 16, height: 16 },
		{ x: 16, y: 0, width: 16, height: 16 },
	],
	left: [
		{ x: 0, y: 16, width: 16, height: 16 },
		{ x: 16, y: 16, width: 16, height: 16 },
	],
	right: [
		{ x: 0, y: 32, width: 16, height: 16 },
		{ x: 16, y: 32, width: 16, height: 16 },
	],
	up: [
		{ x: 0, y: 48, width: 16, height: 16 },
		{ x: 16, y: 48, width: 16, height: 16 },
	],
};

/**
 * Canvas runtime for the registered world maps. Movement stays on a logical
 * 16px grid while rendering interpolates between tiles.
 */
export class OverworldManager
{
	public readonly viewportWidth: number = VIEWPORT_WIDTH;
	public readonly viewportHeight: number = VIEWPORT_HEIGHT;
	public readonly positionLabel: KnockoutObservable<string> = ko.observable(
		`Tile ${WORLD_MAPS.town.defaultSpawn.x}, ${WORLD_MAPS.town.defaultSpawn.y}`,
	);
	public readonly currentMapId: KnockoutObservable<OverworldMapId> = ko.observable("town");
	public readonly currentMapName: KnockoutComputed<string> = ko.pureComputed(() => this.currentMap().name);
	public readonly statusText: KnockoutObservable<string> = ko.observable(WORLD_MAPS.town.statusText);
	public readonly dialogue: OverworldDialogue = new OverworldDialogue();

	private readonly isInputEnabled: () => boolean;
	private readonly useEnrichmentCenterCallback: () => void;
	private readonly startWildEncounterCallback: () => boolean;
	private readonly startTrainerBattleCallback: (trainerId: string, afterBattleMessage: string) => boolean;
	private readonly isTrainerDefeatedCallback: (trainerId: string) => boolean;
	private readonly isTrainerChallengeUnlockedCallback: (trainerId: string) => boolean;
	private readonly runScriptedInteractionCallback: (scriptId: string) => boolean;
	private readonly resolveWarpCallback: (sourceMapId: OverworldMapId, warp: MapWarpDef) => MapWarpDef | null;
	private readonly playerImage: HTMLImageElement = new Image();
	private readonly mapBackgroundImages: Map<string, HTMLImageElement> = new Map();
	private readonly tiledTilesetImages: Map<string, HTMLImageElement> = new Map();
	private readonly npcImages: Map<string, HTMLImageElement> = new Map();
	private readonly npcFacings: Map<string, WalkDirection> = new Map();
	private readonly keyboardHeld: Set<WalkDirection> = new Set();
	private readonly pointerHeld: Set<WalkDirection> = new Set();
	private readonly collisionLabels: Map<string, string> = new Map();
	/** Fully composited tile layers per map, blitted as one drawImage per frame. */
	private readonly prerenderedMaps: Map<OverworldMapId, PrerenderedMap> = new Map();
	/** Maps whose images have all finished decoding. Loaded images never unload. */
	private readonly readyMaps: Set<OverworldMapId> = new Set();

	private player: MapPoint = { ...WORLD_MAPS.town.defaultSpawn };
	private facing: WalkDirection = WORLD_MAPS.town.defaultFacing;
	private movement: MoveState | null = null;
	private statusTimer: number | null = null;
	private mapInputReady: boolean = false;
	private wildEncounterCooldown: number = 0;
	private lastCanvas: HTMLCanvasElement | null = null;
	private lastContext: CanvasRenderingContext2D | null = null;
	private lastDatasetValues: string = "";
	private sortedNpcs: MapNpcDef[] = [];
	private sortedNpcsMapId: OverworldMapId | null = null;
	private frameHandle: number | null = null;
	private idleTimer: number | null = null;
	private disposed: boolean = false;

	constructor(
		isInputEnabled: () => boolean,
		useEnrichmentCenterCallback: () => void,
		startWildEncounterCallback: () => boolean,
		startTrainerBattleCallback: (trainerId: string, afterBattleMessage: string) => boolean,
		isTrainerDefeatedCallback: (trainerId: string) => boolean,
		isTrainerChallengeUnlockedCallback: (trainerId: string) => boolean,
		runScriptedInteractionCallback: (scriptId: string) => boolean,
		resolveWarpCallback: (sourceMapId: OverworldMapId, warp: MapWarpDef) => MapWarpDef | null,
	)
	{
		this.isInputEnabled = isInputEnabled;
		this.useEnrichmentCenterCallback = useEnrichmentCenterCallback;
		this.startWildEncounterCallback = startWildEncounterCallback;
		this.startTrainerBattleCallback = startTrainerBattleCallback;
		this.isTrainerDefeatedCallback = isTrainerDefeatedCallback;
		this.isTrainerChallengeUnlockedCallback = isTrainerChallengeUnlockedCallback;
		this.runScriptedInteractionCallback = runScriptedInteractionCallback;
		this.resolveWarpCallback = resolveWarpCallback;
		this.playerImage.src = "/Areas/Portalmon/Content/Images/Overworld/atlas-walk-16.png";
		for (const map of Object.values(WORLD_MAPS))
		{
			if (map.backgroundImagePath && !this.mapBackgroundImages.has(map.backgroundImagePath))
				this.mapBackgroundImages.set(map.backgroundImagePath, this.loadImage(map.backgroundImagePath));
			for (const tileset of map.tilesets ?? [])
			{
				if (!this.tiledTilesetImages.has(tileset.imagePath))
					this.tiledTilesetImages.set(tileset.imagePath, this.loadImage(tileset.imagePath));
			}
			for (const npc of map.npcs)
			{
				if (npc.spritePath && !this.npcImages.has(npc.spritePath))
					this.npcImages.set(npc.spritePath, this.loadImage(npc.spritePath));
				this.npcFacings.set(this.npcKey(map.id, npc.id), npc.initialFacing);
			}
		}
		this.buildCollisionMap();

		document.addEventListener("keydown", this.handleKeyDown);
		document.addEventListener("keyup", this.handleKeyUp);
		document.addEventListener("pointerup", this.releasePointerDirections);
		this.frameHandle = requestAnimationFrame(this.renderLoop);
	}

	public pressDirection = (direction: WalkDirection, event?: Event): boolean =>
	{
		event?.preventDefault();
		if (this.dialogue.visible())
		{
			if (this.dialogue.isChoosing())
				this.dialogue.moveChoice(direction === "left" || direction === "up" ? -1 : 1);
			return true;
		}
		const accepted = this.canAcceptMovement();
		if (perfProbe.enabled) perfProbe.markInput(accepted);
		if (!accepted) return true;
		this.pointerHeld.add(direction);
		this.tryStartMove(performance.now(), direction);
		return true;
	};

	public releaseDirection = (direction: WalkDirection, event?: Event): boolean =>
	{
		event?.preventDefault();
		this.pointerHeld.delete(direction);
		return true;
	};

	private useEnrichmentCenter = (): void =>
	{
		if (!this.isInputEnabled()) return;
		this.dialogue.close();
		this.keyboardHeld.clear();
		this.pointerHeld.clear();
		this.useEnrichmentCenterCallback();
	};

	public interact = (): void =>
	{
		if (!this.isInputEnabled()) return;
		this.keyboardHeld.clear();
		this.pointerHeld.clear();

		if (this.dialogue.visible())
		{
			this.dialogue.advance();
			return;
		}
		if (!this.mapInputReady) return;
		if (this.movement) return;

		const delta = DIRECTION_DELTAS[this.facing];
		const target: MapPoint = {
			x: this.player.x + delta.x,
			y: this.player.y + delta.y,
		};
		const npc = this.currentMap().npcs.find(candidate => this.pointsEqual(candidate.position, target));
		if (npc)
		{
			this.npcFacings.set(
				this.npcKey(this.currentMap().id, npc.id),
				this.oppositeDirection(this.facing),
			);
			if (npc.scriptId && this.runScriptedInteractionCallback(npc.scriptId)) return;
			if (npc.trainerId)
			{
				if (this.isTrainerDefeatedCallback(npc.trainerId))
				{
					this.dialogue.open(npc.afterBattleDialogue ?? npc.dialogue);
					return;
				}
				if (!this.isTrainerChallengeUnlockedCallback(npc.trainerId))
				{
					this.dialogue.open({
						speaker: npc.name,
						lines: [...npc.dialogue.lines, "(He doesn't acknowledge challengers who haven't defeated GLaDOS.)"],
					});
					return;
				}
				this.dialogue.openChoice({
					speaker: npc.dialogue.speaker,
					lines: [...npc.dialogue.lines, `Challenge ${npc.name}?`],
				}, [
					{
						label: "YES",
						action: () =>
						{
							if (!this.startTrainerBattleCallback(npc.trainerId!, npc.afterBattleDialogue?.lines[0] ?? ""))
								this.showTemporaryStatus("Battle unavailable - prepare your party first");
						},
					},
					{ label: "NO", action: () => undefined },
				]);
				return;
			}
			this.dialogue.open(npc.dialogue);
			return;
		}
		this.showTemporaryStatus("Nothing there - face someone and press TALK");
	};

	/** Move the player to an explicitly configured destination without a warp source tile. */
	public teleportTo(destination: MapTeleportDestination): void
	{
		this.mapInputReady = false;
		this.keyboardHeld.clear();
		this.pointerHeld.clear();
		this.dialogue.close();
		this.currentMapId(destination.mapId);
		this.player = { ...destination.position };
		this.facing = destination.facing;
		this.movement = null;
		this.positionLabel(`Tile ${this.player.x}, ${this.player.y}`);
		this.statusText(this.currentMap().statusText);
		this.buildCollisionMap();
	}

	public teleportToSpawn(mapId: OverworldMapId, spawnId: string): boolean
	{
		const map = WORLD_MAPS[mapId];
		const spawn = map?.spawns.find(candidate => candidate.id === spawnId);
		if (!spawn) return false;
		this.teleportTo({ mapId, position: spawn.position, facing: spawn.facing });
		return true;
	}

	private handleKeyDown = (event: KeyboardEvent): void =>
	{
		if (!this.isInputEnabled() || this.isTypingTarget(event.target)) return;
		if (this.isInteractionKey(event.key))
		{
			event.preventDefault();
			if (!event.repeat) this.interact();
			return;
		}

		const direction = this.directionForKey(event.key);
		if (!direction) return;
		if (this.dialogue.visible())
		{
			if (this.dialogue.isChoosing() && !event.repeat)
			{
				event.preventDefault();
				this.dialogue.moveChoice(direction === "left" || direction === "up" ? -1 : 1);
			}
			return;
		}
		const accepted = this.canAcceptMovement();
		if (perfProbe.enabled && !event.repeat) perfProbe.markInput(accepted);
		if (!accepted) return;
		event.preventDefault();
		this.keyboardHeld.add(direction);
		this.tryStartMove(performance.now(), direction);
	};

	private handleKeyUp = (event: KeyboardEvent): void =>
	{
		const direction = this.directionForKey(event.key);
		if (!direction) return;
		this.keyboardHeld.delete(direction);
	};

	private releasePointerDirections = (): void =>
	{
		this.pointerHeld.clear();
	};

	private directionForKey(key: string): WalkDirection | null
	{
		const normalized = key.toLowerCase();
		if (normalized === "arrowup" || normalized === "w") return "up";
		if (normalized === "arrowdown" || normalized === "s") return "down";
		if (normalized === "arrowleft" || normalized === "a") return "left";
		if (normalized === "arrowright" || normalized === "d") return "right";
		return null;
	}

	private isInteractionKey(key: string): boolean
	{
		const normalized = key.toLowerCase();
		return normalized === "enter" || normalized === " " || normalized === "e";
	}

	private isTypingTarget(target: EventTarget | null): boolean
	{
		const element = target as HTMLElement | null;
		return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || !!element?.isContentEditable;
	}

	private canAcceptMovement(): boolean
	{
		return this.isInputEnabled() && this.mapInputReady && this.areMapAssetsReady(this.currentMap());
	}

	/**
	 * Memoized because it runs twice per frame and walks every NPC. A decoded
	 * image never reverts to undecoded, so the first true answer is permanent.
	 */
	private areMapAssetsReady(map: OverworldMapDef): boolean
	{
		if (this.readyMaps.has(map.id)) return true;
		if (!this.computeMapAssetsReady(map)) return false;
		this.readyMaps.add(map.id);
		return true;
	}

	private computeMapAssetsReady(map: OverworldMapDef): boolean
	{
		// A map with neither a background nor tilesets has no terrain to wait on.
		// WorldMapRegistry rejects such maps, so this is a guard, not a real case.
		const backgroundReady = map.backgroundImagePath
			? (this.mapBackgroundImages.get(map.backgroundImagePath)?.naturalWidth ?? 0) > 0
			: map.tilesets
				? map.tilesets.every(tileset => (this.tiledTilesetImages.get(tileset.imagePath)?.naturalWidth ?? 0) > 0)
			: true;
		if (!backgroundReady || this.playerImage.naturalWidth <= 0) return false;
		return map.npcs.every(npc => !npc.spritePath || (this.npcImages.get(npc.spritePath)?.naturalWidth ?? 0) > 0);
	}

	/** Stops the render loop and releases the document-level input listeners. */
	public dispose(): void
	{
		this.disposed = true;
		if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
		if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
		if (this.statusTimer !== null) window.clearTimeout(this.statusTimer);
		this.frameHandle = null;
		this.idleTimer = null;
		this.statusTimer = null;
		document.removeEventListener("keydown", this.handleKeyDown);
		document.removeEventListener("keyup", this.handleKeyUp);
		document.removeEventListener("pointerup", this.releasePointerDirections);
	}

	/**
	 * Re-querying the document every frame is wasted work once the canvas is
	 * known, and the cost scales with the host page's DOM size.
	 */
	private resolveCanvas(): HTMLCanvasElement | null
	{
		if (this.lastCanvas?.isConnected) return this.lastCanvas;
		return document.getElementById("pk-overworld-canvas") as HTMLCanvasElement | null;
	}

	private renderLoop = (now: number): void =>
	{
		this.frameHandle = null;
		let drew = false;
		const probing = perfProbe.enabled;
		try
		{
			const canvas = this.resolveCanvas();
			if (canvas !== this.lastCanvas)
			{
				this.lastCanvas = canvas;
				this.lastContext = null;
				this.lastDatasetValues = "";
				this.mapInputReady = false;
			}
			this.updateMovement(now);
			if (canvas && this.isInputEnabled())
			{
				const drawStartedAt = probing ? performance.now() : 0;
				this.draw(canvas, now);
				drew = true;
				if (probing) perfProbe.recordDraw(performance.now() - drawStartedAt, canvas);
			}
		}
		catch (error)
		{
			this.mapInputReady = false;
			console.error("Overworld render frame failed; retrying on the next frame.", error);
		}
		finally
		{
			if (probing) perfProbe.recordFrame(now, drew);
			this.scheduleNextFrame(drew);
		}
	};

	/** Exactly one re-arm path per frame so the loop can never double-start. */
	private scheduleNextFrame(drew: boolean): void
	{
		if (this.disposed) return;
		if (drew)
		{
			this.frameHandle = requestAnimationFrame(this.renderLoop);
			return;
		}
		this.idleTimer = window.setTimeout(
			() =>
			{
				this.idleTimer = null;
				if (!this.disposed) this.frameHandle = requestAnimationFrame(this.renderLoop);
			},
			IDLE_POLL_MS,
		);
	}

	private updateMovement(now: number): void
	{
		if (!this.canAcceptMovement())
		{
			this.keyboardHeld.clear();
			this.pointerHeld.clear();
			return;
		}
		if (this.dialogue.visible())
		{
			this.keyboardHeld.clear();
			this.pointerHeld.clear();
			return;
		}

		if (this.movement && now - this.movement.startedAt >= MOVE_DURATION_MS)
		{
			const completedMove = this.movement;
			this.player = completedMove.to;
			this.movement = null;
			this.positionLabel(`Tile ${this.player.x}, ${this.player.y}`);

			if (!this.resolvePortal(completedMove.direction)) return;
			const warp = this.currentMap().warps.find(candidate => this.pointsEqual(candidate.position, this.player));
			if (warp)
			{
				this.enterMap(warp);
				return;
			}
			const interaction = this.currentMap().interactions.find(
				candidate => this.pointsEqual(candidate.position, this.player),
			);
			if (interaction)
			{
				this.activateInteraction(interaction);
				return;
			}
			if (this.tryStartWildEncounter()) return;
			if (this.isIceTile(this.player))
			{
				this.tryStartMove(now, completedMove.direction);
				return;
			}
		}

		if (!this.movement)
		{
			const nextDirection = this.lastHeldDirection();
			if (nextDirection) this.tryStartMove(now, nextDirection);
		}
	}

	private lastHeldDirection(): WalkDirection | null
	{
		const held = [...this.pointerHeld, ...this.keyboardHeld];
		return held.length > 0 ? held[held.length - 1] : null;
	}

	private tryStartMove(now: number, direction: WalkDirection): void
	{
		if (this.movement) return;
		const delta = DIRECTION_DELTAS[direction];
		const destination: MapPoint = {
			x: this.player.x + delta.x,
			y: this.player.y + delta.y,
		};
		this.facing = direction;

		const collision = this.collisionLabels.get(this.pointKey(destination));
		const map = this.currentMap();
		if (destination.x < 0 || destination.x >= map.width || destination.y < 0 || destination.y >= map.height)
		{
			this.showTemporaryStatus("Boundary reached - still snapped to the map");
			return;
		}
		if (collision)
		{
			this.showTemporaryStatus(`Blocked - ${collision}`);
			return;
		}

		this.movement = {
			from: { ...this.player },
			to: destination,
			direction,
			startedAt: now,
		};
	}

	/** Resolve one portal landing. The destination portal is never re-entered in the same step. */
	private resolvePortal(direction: WalkDirection): boolean
	{
		const map = this.currentMap();
		const source = map.portals.find(portal => this.pointsEqual(portal.position, this.player));
		if (!source) return true;

		const endpoints = map.portals.filter(portal => portal.portalId === source.portalId);
		const destination = endpoints.find(portal => !this.pointsEqual(portal.position, source.position));
		if (!destination)
		{
			console.error(`Portal ${source.portalId} does not have a linked destination.`);
			this.showTemporaryStatus("Portal link missing");
			return false;
		}

		const offset = destination.directionalExit ? DIRECTION_DELTAS[direction] : { x: 0, y: 0 };
		const exit: MapPoint = {
			x: destination.position.x + offset.x,
			y: destination.position.y + offset.y,
		};
		const blocked = this.collisionLabels.get(this.pointKey(exit));
		if (exit.x < 0 || exit.x >= map.width || exit.y < 0 || exit.y >= map.height || blocked)
		{
			console.error(`Portal ${source.portalId} exits into an invalid tile.`, { direction, exit, blocked });
			this.showTemporaryStatus("Portal exit blocked");
			return false;
		}

		this.player = exit;
		this.facing = direction;
		this.positionLabel(`Tile ${this.player.x}, ${this.player.y}`);
		return true;
	}

	private isIceTile(point: MapPoint): boolean
	{
		return this.currentMap().iceTiles.some(candidate => this.pointsEqual(candidate, point));
	}

	private tryStartWildEncounter(): boolean
	{
		const map = this.currentMap();
		const inWildZone = map.encounterZones.some(zone =>
			this.player.x >= zone.x
			&& this.player.x < zone.x + zone.width
			&& this.player.y >= zone.y
			&& this.player.y < zone.y + zone.height,
		);
		if (!inWildZone)
		{
			this.wildEncounterCooldown = 0;
			return false;
		}
		if (this.wildEncounterCooldown > 0)
		{
			this.wildEncounterCooldown--;
			return false;
		}
		if (Math.random() >= WILD_ENCOUNTER_CHANCE) return false;
		if (!this.startWildEncounterCallback()) return false;

		this.wildEncounterCooldown = WILD_ENCOUNTER_COOLDOWN_STEPS;
		this.keyboardHeld.clear();
		this.pointerHeld.clear();
		return true;
	}

	private draw(canvas: HTMLCanvasElement, now: number): void
	{
		if (canvas.width !== VIEWPORT_WIDTH) canvas.width = VIEWPORT_WIDTH;
		if (canvas.height !== VIEWPORT_HEIGHT) canvas.height = VIEWPORT_HEIGHT;
		const context = this.lastContext ?? canvas.getContext("2d");
		if (!context) return;
		this.lastContext = context;
		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

		const renderPlayer = this.getRenderPlayer(now);
		const camera = this.getCameraPosition(renderPlayer);
		const map = this.currentMap();
		this.drawTerrain(context, camera, map);
		const actorsReady = this.areMapAssetsReady(map);
		if (perfProbe.publishDataset) this.publishDebugState(canvas, camera, map, actorsReady);
		if (!actorsReady)
		{
			this.mapInputReady = false;
			return;
		}

		// Painter's order by feet. NPC positions are static per map, so the
		// sorted list is cached and only the player has to be placed each frame.
		// The previous form allocated an array plus one closure per NPC every
		// frame; that is invisible locally and shows up as GC pressure against a
		// host page with a much larger retained heap.
		const npcs = this.getSortedNpcs(map);
		let playerDrawn = false;
		for (const npc of npcs)
		{
			if (!playerDrawn && renderPlayer.y <= npc.position.y)
			{
				this.drawPlayer(context, now, renderPlayer, camera);
				playerDrawn = true;
			}
			this.drawNpc(context, camera, map, npc);
		}
		if (!playerDrawn) this.drawPlayer(context, now, renderPlayer, camera);
		this.mapInputReady = true;
	}

	/** NPCs sorted by their draw order, rebuilt only when the map changes. */
	private getSortedNpcs(map: OverworldMapDef): readonly MapNpcDef[]
	{
		if (this.sortedNpcsMapId === map.id) return this.sortedNpcs;
		this.sortedNpcs = map.npcs.slice().sort((left, right) => left.position.y - right.position.y);
		this.sortedNpcsMapId = map.id;
		return this.sortedNpcs;
	}

	/**
	 * Mirrors the camera and readiness state onto the canvas for debugging.
	 * Only written while the profiler is enabled. The camera changes every frame
	 * during movement, so these are four attribute mutations per frame, and on a
	 * real host page every registered MutationObserver runs against each one.
	 */
	private publishDebugState(
		canvas: HTMLCanvasElement,
		camera: MapPoint,
		map: OverworldMapDef,
		actorsReady: boolean,
	): void
	{
		const cameraX = camera.x.toFixed(2);
		const cameraY = camera.y.toFixed(2);
		const readyFlag = actorsReady ? "true" : "false";
		const signature = `${cameraX}|${cameraY}|${map.id}|${readyFlag}`;
		if (signature === this.lastDatasetValues) return;
		this.lastDatasetValues = signature;
		canvas.dataset.cameraX = cameraX;
		canvas.dataset.cameraY = cameraY;
		canvas.dataset.mapId = map.id;
		canvas.dataset.actorsReady = readyFlag;
	}

	private drawTerrain(context: CanvasRenderingContext2D, camera: MapPoint, map: OverworldMapDef): void
	{
		context.fillStyle = map.backgroundColor;
		context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
		if (map.backgroundImagePath)
		{
			const background = this.mapBackgroundImages.get(map.backgroundImagePath);
			if (!background || background.naturalWidth <= 0) return;
			context.drawImage(
				background,
				Math.round(camera.x),
				Math.round(camera.y),
				VIEWPORT_WIDTH,
				VIEWPORT_HEIGHT,
				0,
				0,
				VIEWPORT_WIDTH,
				VIEWPORT_HEIGHT,
			);
			return;
		}
		if (map.tileLayers && map.tilesets?.length) this.drawTiledLayers(context, camera, map);
	}

	private drawTiledLayers(context: CanvasRenderingContext2D, camera: MapPoint, map: OverworldMapDef): void
	{
		if (!map.tilesets?.length || !map.tileLayers) return;

		// Tile layers are static, so compositing them per frame redraws the same
		// pixels forever. Gym 1 alone is four layers over ~176 visible cells,
		// which is ~700 drawImage calls and ~700 tileset lookups every frame.
		const prerendered = this.getPrerenderedMap(map);
		if (prerendered)
		{
			context.drawImage(
				prerendered.canvas,
				Math.round(camera.x),
				Math.round(camera.y) + prerendered.overdrawTop,
				VIEWPORT_WIDTH,
				VIEWPORT_HEIGHT,
				0,
				0,
				VIEWPORT_WIDTH,
				VIEWPORT_HEIGHT,
			);
			return;
		}

		// Fallback for the frames before every tileset image has decoded.
		const firstX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
		const lastX = Math.min(map.width - 1, Math.ceil((camera.x + VIEWPORT_WIDTH) / TILE_SIZE));
		const firstY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
		const lastY = Math.min(map.height - 1, Math.ceil((camera.y + VIEWPORT_HEIGHT) / TILE_SIZE));
		for (const layer of map.tileLayers)
		{
			for (let y = firstY; y <= lastY; y++)
			{
				for (let x = firstX; x <= lastX; x++)
				{
					const gid = layer[y * map.width + x] & 0x1FFFFFFF;
					const tileset = map.tilesets.find(candidate =>
						gid >= candidate.firstGid && gid < candidate.firstGid + candidate.tileCount,
					);
					if (!tileset) continue;
					const image = this.tiledTilesetImages.get(tileset.imagePath);
					if (!image || image.naturalWidth <= 0) continue;
					const tileIndex = gid - tileset.firstGid;
					const tileWidth = tileset.tileWidth ?? TILE_SIZE;
					const tileHeight = tileset.tileHeight ?? TILE_SIZE;
					context.drawImage(
						image,
						tileset.margin + (tileIndex % tileset.columns) * (tileWidth + tileset.spacing),
						tileset.margin + Math.floor(tileIndex / tileset.columns) * (tileHeight + tileset.spacing),
						tileWidth,
						tileHeight,
						Math.round(x * TILE_SIZE - camera.x),
						Math.round(y * TILE_SIZE - camera.y + TILE_SIZE - tileHeight),
						tileWidth,
						tileHeight,
					);
				}
			}
		}
	}

	/**
	 * Composites every tile layer of a map into one canvas. Built once per map,
	 * the first time all of its tileset images have decoded, and reused for the
	 * rest of the session because tile layers never change at runtime.
	 */
	private getPrerenderedMap(map: OverworldMapDef): PrerenderedMap | null
	{
		const cached = this.prerenderedMaps.get(map.id);
		if (cached) return cached;

		const tilesets = map.tilesets;
		const layers = map.tileLayers;
		if (!tilesets?.length || !layers) return null;

		const images = tilesets.map(tileset => this.tiledTilesetImages.get(tileset.imagePath));
		if (images.some(image => !image || image.naturalWidth <= 0)) return null;

		// Tiles bigger than one cell hang above and to the right of their cell,
		// so pad the canvas rather than clipping them at the map edges.
		let overdrawTop = 0;
		let overdrawRight = 0;
		for (const tileset of tilesets)
		{
			overdrawTop = Math.max(overdrawTop, (tileset.tileHeight ?? TILE_SIZE) - TILE_SIZE);
			overdrawRight = Math.max(overdrawRight, (tileset.tileWidth ?? TILE_SIZE) - TILE_SIZE);
		}

		const canvas = document.createElement("canvas");
		canvas.width = map.width * TILE_SIZE + overdrawRight;
		canvas.height = map.height * TILE_SIZE + overdrawTop;
		const context = canvas.getContext("2d");
		if (!context) return null;
		context.imageSmoothingEnabled = false;

		for (const layer of layers)
		{
			for (let y = 0; y < map.height; y++)
			{
				for (let x = 0; x < map.width; x++)
				{
					const gid = layer[y * map.width + x] & 0x1FFFFFFF;
					if (gid === 0) continue;
					const tilesetIndex = tilesets.findIndex(candidate =>
						gid >= candidate.firstGid && gid < candidate.firstGid + candidate.tileCount,
					);
					if (tilesetIndex < 0) continue;
					const tileset = tilesets[tilesetIndex];
					const image = images[tilesetIndex]!;
					const tileIndex = gid - tileset.firstGid;
					const tileWidth = tileset.tileWidth ?? TILE_SIZE;
					const tileHeight = tileset.tileHeight ?? TILE_SIZE;
					context.drawImage(
						image,
						tileset.margin + (tileIndex % tileset.columns) * (tileWidth + tileset.spacing),
						tileset.margin + Math.floor(tileIndex / tileset.columns) * (tileHeight + tileset.spacing),
						tileWidth,
						tileHeight,
						x * TILE_SIZE,
						y * TILE_SIZE + TILE_SIZE - tileHeight + overdrawTop,
						tileWidth,
						tileHeight,
					);
				}
			}
		}

		const prerendered: PrerenderedMap = { canvas, overdrawTop, overdrawRight };
		this.prerenderedMaps.set(map.id, prerendered);
		return prerendered;
	}

	private drawPlayer(context: CanvasRenderingContext2D, now: number, renderPlayer: MapPoint, camera: MapPoint): void
	{
		if (this.playerImage.naturalWidth <= 0) return;
		let frameColumn = 0;
		if (this.movement)
		{
			const progress = Math.min(1, (now - this.movement.startedAt) / MOVE_DURATION_MS);
			frameColumn = Math.min(1, Math.floor(progress * 2));
		}

		const frame = PLAYER_FRAME_RECTS[this.facing]?.[frameColumn] ?? PLAYER_FRAME_RECTS.down[0];
		const destinationWidth = frame.width * PLAYER_PIXEL_SCALE;
		const destinationHeight = frame.height * PLAYER_PIXEL_SCALE;
		const footX = renderPlayer.x * TILE_SIZE + TILE_SIZE / 2 - camera.x;
		const footY = renderPlayer.y * TILE_SIZE + TILE_SIZE - camera.y;
		context.drawImage(
			this.playerImage,
			frame.x,
			frame.y,
			frame.width,
			frame.height,
			Math.round(footX - destinationWidth / 2),
			Math.round(footY - destinationHeight),
			Math.round(destinationWidth),
			Math.round(destinationHeight),
		);
	}

	private drawNpc(
		context: CanvasRenderingContext2D,
		camera: MapPoint,
		map: OverworldMapDef,
		npc: MapNpcDef,
	): void
	{
		if (!npc.spritePath) return;
		const image = this.npcImages.get(npc.spritePath);
		if (!image || image.naturalWidth <= 0) return;
		const facing = this.npcFacings.get(this.npcKey(map.id, npc.id)) ?? npc.initialFacing;
		const isCompactSprite = npc.spriteTileIndex !== undefined;
		const cellIndex = DIRECTION_ROWS[facing];
		const sourceWidth = isCompactSprite ? TILE_SIZE : image.naturalWidth / 2;
		const sourceHeight = isCompactSprite ? TILE_SIZE : image.naturalHeight / 2;
		const compactColumns = isCompactSprite ? Math.floor(image.naturalWidth / TILE_SIZE) : 0;
		const sourceX = isCompactSprite ? (npc.spriteTileIndex! % compactColumns) * TILE_SIZE : (cellIndex % 2) * sourceWidth;
		const sourceY = isCompactSprite
			? Math.floor(npc.spriteTileIndex! / compactColumns) * (TILE_SIZE + (npc.spriteRowGap ?? 0))
			: Math.floor(cellIndex / 2) * sourceHeight;
		const spriteSize = isCompactSprite ? TILE_SIZE : 32;
		context.drawImage(
			image,
			sourceX,
			sourceY,
			sourceWidth,
			sourceHeight,
			Math.round(npc.position.x * TILE_SIZE + TILE_SIZE / 2 - spriteSize / 2 - camera.x),
			Math.round(npc.position.y * TILE_SIZE + TILE_SIZE - spriteSize + 3 - camera.y),
			spriteSize,
			spriteSize,
		);
	}

	private getRenderPlayer(now: number): MapPoint
	{
		if (!this.movement) return { ...this.player };
		const progress = Math.min(1, (now - this.movement.startedAt) / MOVE_DURATION_MS);
		return {
			x: this.lerp(this.movement.from.x, this.movement.to.x, progress),
			y: this.lerp(this.movement.from.y, this.movement.to.y, progress),
		};
	}

	private getCameraPosition(renderPlayer: MapPoint): MapPoint
	{
		const map = this.currentMap();
		const desiredX = renderPlayer.x * TILE_SIZE + TILE_SIZE / 2 - VIEWPORT_WIDTH / 2;
		const desiredY = renderPlayer.y * TILE_SIZE + TILE_SIZE / 2 - VIEWPORT_HEIGHT / 2;
		return {
			x: this.clamp(desiredX, 0, Math.max(0, map.width * TILE_SIZE - VIEWPORT_WIDTH)),
			y: this.clamp(desiredY, 0, Math.max(0, map.height * TILE_SIZE - VIEWPORT_HEIGHT)),
		};
	}

	private buildCollisionMap(): void
	{
		this.collisionLabels.clear();
		const map = this.currentMap();
		for (const rectangle of map.collisionRects)
		{
			for (let y = rectangle.y; y < rectangle.y + rectangle.height; y++)
				for (let x = rectangle.x; x < rectangle.x + rectangle.width; x++)
				{
					const point = { x, y };
					this.collisionLabels.set(this.pointKey(point), rectangle.label);
				}
		}
		for (const point of map.collisionPoints)
			this.collisionLabels.set(this.pointKey(point), point.label);
		for (const npc of map.npcs)
			this.collisionLabels.set(this.pointKey(npc.position), npc.name);
	}

	private pointKey(point: MapPoint): string
	{
		return `${point.x},${point.y}`;
	}

	private showTemporaryStatus(message: string): void
	{
		this.statusText(message);
		if (this.statusTimer !== null) window.clearTimeout(this.statusTimer);
		this.statusTimer = window.setTimeout(
			() => this.statusText(this.currentMap().statusText),
			900,
		);
	}

	private enterMap(warp: MapWarpDef): void
	{
		const resolvedWarp = this.resolveWarpCallback(this.currentMap().id, warp);
		if (!resolvedWarp) return;
		warp = resolvedWarp;
		const targetMap = WORLD_MAPS[warp.targetMapId];
		const spawn = targetMap?.spawns.find(candidate => candidate.id === warp.targetSpawnId);
		if (!spawn)
		{
			console.error(`Missing spawn '${warp.targetSpawnId}' in map '${warp.targetMapId}'.`);
			this.showTemporaryStatus("Warp destination missing");
			return;
		}
		this.teleportTo({
			mapId: warp.targetMapId,
			position: spawn.position,
			facing: spawn.facing,
		});
	}

	private activateInteraction(interaction: MapInteractionDef): void
	{
		this.keyboardHeld.clear();
		this.pointerHeld.clear();
		if (interaction.kind === "center") this.useEnrichmentCenter();
	}

	private currentMap(): OverworldMapDef
	{
		return WORLD_MAPS[this.currentMapId()];
	}

	private npcKey(mapId: OverworldMapId, npcId: string): string
	{
		return `${mapId}:${npcId}`;
	}

	private loadImage(path: string): HTMLImageElement
	{
		const image = new Image();
		image.src = path;
		return image;
	}

	private pointsEqual(left: MapPoint, right: MapPoint): boolean
	{
		return left.x === right.x && left.y === right.y;
	}

	private oppositeDirection(direction: WalkDirection): WalkDirection
	{
		if (direction === "up") return "down";
		if (direction === "down") return "up";
		if (direction === "left") return "right";
		return "left";
	}

	private clamp(value: number, minimum: number, maximum: number): number
	{
		return Math.min(maximum, Math.max(minimum, value));
	}

	private lerp(from: number, to: number, progress: number): number
	{
		return from + (to - from) * progress;
	}
}

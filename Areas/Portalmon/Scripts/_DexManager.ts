import { CreatureDex, SpeciesId, SpeciesDef } from "./data/CreatureList";
import { MoveLibrary, PortalKombatMoveDef } from "./data/MoveList";
import { ChargeArchetype, UltimateDef, UltimateLibrary } from "./data/UltimateList";
import { PortalmonCache } from "./PortalmonController";
import { buildMoveTooltip } from "./HelperFunctions";

type DexSpriteMode = "front" | "rear";

const DEX_EVOLUTION_THRESHOLD = 3;

export class DexManager
{
	public cache: PortalmonCache;

	/** All creatures in the dex, built once from CreatureDex */
	public allCreatures: KnockoutObservableArray<DexEntry>;

	/**
	 * Creatures sorted for display: caught -> seen -> undiscovered, alpha within each group.
	 * Use this in the grid instead of allCreatures directly.
	 */
	public sortedCreatures: KnockoutComputed<DexEntry[]>;

	/** Currently selected creature for the detail panel */
	public selectedCreature: KnockoutObservable<DexEntry | null>;

	/** Sprite view mode for the selected creature detail panel */
	public detailSpriteMode: KnockoutObservable<DexSpriteMode>;

	/** Currently active party (up to 3 species IDs), kept in sync with cache */
	public selectedParty: KnockoutObservableArray<SpeciesId>;

	/**
	 * Array of placeholder indices for rendering empty party slots in the bar.
	 * e.g. party of 1 -> [0, 1]; full party -> [].
	 */
	public emptyPartySlots: KnockoutComputed<number[]>;

	/**
	 * Set to combatManager.isInActiveBattle after both managers are constructed
	 * in PortalKombatManager. Defaults to always-false so the dex is usable
	 * in isolation (e.g. tests, starter flow).
	 */
	public isInActiveBattle: KnockoutComputed<boolean> = ko.pureComputed(() => false);

	/** Shown briefly when the player tries to add a 4th creature to the party */
	public partyFullWarning: KnockoutObservable<boolean> = ko.observable(false);
	private _partyFullTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(cache: PortalmonCache)
	{
		this.cache = cache;
		this.selectedParty = ko.observableArray(cache.selectedParty || []);
		this.selectedCreature = ko.observable(null);
		this.detailSpriteMode = ko.observable("front");

		const entries: DexEntry[] = Object.values(CreatureDex).map(species =>
		{
			const caughtCount = cache.caughtCreatures[species.id] || 0;
			const isSeen = !!cache.seenCreatures[species.id];
			const currentHp = cache.creatureHealth[species.id] ?? species.base.hp;
			return new DexEntry(species, caughtCount, isSeen, currentHp, this);
		});

		this.allCreatures = ko.observableArray(entries);

		this.sortedCreatures = ko.pureComputed(() =>
		{
			const rank = (e: DexEntry) => e.isCaught() ? 0 : e.isSeen() ? 1 : 2;
			return this.allCreatures().slice().sort((a, b) =>
			{
				const diff = rank(a) - rank(b);
				return diff !== 0 ? diff : a.species.name.localeCompare(b.species.name);
			});
		});

		this.emptyPartySlots = ko.pureComputed(() =>
		{
			const empty = Math.max(0, 3 - this.selectedParty().length);
			return Array.from({ length: empty }, (_, i) => i);
		});
	}

	/**
	 * Syncs all dex entries and the party observable from the cache.
	 * Call this after catching/seeing creatures, or after any party/HP change.
	 */
	public refreshFromCache = (): void =>
	{
		this.allCreatures().forEach(entry =>
		{
			entry.caughtCount(this.cache.caughtCreatures[entry.species.id] || 0);
			entry.isSeen(!!this.cache.seenCreatures[entry.species.id]);
			entry.currentHp(this.cache.creatureHealth[entry.species.id] ?? entry.species.base.hp);
		});

		// Sync party observable - this is what drives isInParty on every DexEntry
		this.selectedParty(this.cache.selectedParty || []);
	};

	/** Looks up a DexEntry by species ID - used by the party bar to render slots in order */
	public getEntryBySpeciesId = (speciesId: SpeciesId): DexEntry | undefined =>
	{
		return this.allCreatures().find(e => e.species.id === speciesId);
	};

	public selectCreature = (entry: DexEntry): void =>
	{
		if (!entry.isDiscovered()) return;
		this.detailSpriteMode("front");
		this.selectedCreature(entry);
	};

	public clearSelection = (): void =>
	{
		this.selectedCreature(null);
		this.detailSpriteMode("front");
	};

	public selectRandomDiscovered = (): void =>
	{
		const discovered = this.allCreatures().filter(entry => entry.isDiscovered());
		if (discovered.length === 0) return;

		const choice = discovered[Math.floor(Math.random() * discovered.length)];
		this.selectCreature(choice);
	};

	/** Returns true if a species is currently in the active party */
	public isInParty = (speciesId: SpeciesId): boolean =>
	{
		return this.selectedParty().includes(speciesId);
	};

	/**
	 * Toggles a caught creature in or out of the party (max 3).
	 * No-ops silently if a battle is active - party changes mid-fight are blocked.
	 * Shows an inline warning if the party is already full.
	 * Persists the change to cache immediately.
	 */
	public toggleParty = (entry: DexEntry): void =>
	{
		if (!entry.isCaught()) return;
		if (this.isInActiveBattle()) return; // blocked - button should be disabled too, this is a safety net

		const speciesId = entry.species.id;

		if (this.isInParty(speciesId))
		{
			this.selectedParty.remove(speciesId);
		}
		else
		{
			if (this.selectedParty().length >= 3)
			{
				this._flashPartyFullWarning();
				return;
			}
			this.selectedParty.push(speciesId);
		}

		this.cache.selectedParty = this.selectedParty();
		this.cache.saveCache();
	};

	/** Briefly shows the party-full warning then auto-dismisses it */
	private _flashPartyFullWarning(): void
	{
		if (this._partyFullTimer) clearTimeout(this._partyFullTimer);
		this.partyFullWarning(true);
		this._partyFullTimer = setTimeout(() => this.partyFullWarning(false), 2500);
	}

	public showFrontSprite = (): void =>
	{
		this.detailSpriteMode("front");
	};

	public showRearSprite = (): void =>
	{
		this.detailSpriteMode("rear");
	};

	/** Builds an HTML tooltip for a move (matches battle tooltip format) */
	public getMoveTooltip = (move: PortalKombatMoveDef): string =>
		buildMoveTooltip(move);

	public getChargeArchetypeSummary = (archetype?: ChargeArchetype): string =>
	{
		switch (archetype)
		{
			case "Brawler": return "Charges faster by landing direct damage.";
			case "Endurance": return "Charges faster by soaking hits and surviving pressure.";
			case "Tactician": return "Charges faster from setup and control turns.";
			case "Momentum": return "Charges faster by staying in and keeping tempo.";
			case "Chaos": return "Charges in messy bursts when the battle gets weird.";
			default: return "No ultimate telemetry available.";
		}
	};
}

/** Represents a single creature entry in the Dex */
export class DexEntry
{
	public species: SpeciesDef;
	private manager: DexManager;

	/** Number of times this creature has been caught */
	public caughtCount: KnockoutObservable<number>;

	/** True if the creature has been seen in an encounter */
	public isSeen: KnockoutObservable<boolean>;

	/** Current HP, synced from cache - only meaningful for caught creatures */
	public currentHp: KnockoutObservable<number>;

	/** True if caught at least once */
	public isCaught: KnockoutComputed<boolean>;

	/** True if seen or caught (unlocks the detail view) */
	public isDiscovered: KnockoutComputed<boolean>;

	/** Shows the real name once discovered, otherwise "???" */
	public displayName: KnockoutComputed<string>;

	/** True if this species is currently in the active party */
	public isInParty: KnockoutComputed<boolean>;

	/** HP as a 0-100 percentage of the species max */
	public hpPercent: KnockoutComputed<number>;

	/** Resolved move definitions for this species */
	public resolvedMoves: PortalKombatMoveDef[];

	/** Resolved ultimate definition for this species, if present */
	public resolvedUltimate: UltimateDef | null;

	/** Prior evolution in the line, if any */
	public evolvesFromSpecies: SpeciesDef | null;

	/** Next evolution in the line, if any */
	public evolvesToSpecies: SpeciesDef | null;

	public hasBackSprite: KnockoutComputed<boolean>;
	public detailSpriteSrc: KnockoutComputed<string | null>;
	public detailTags: KnockoutComputed<string[]>;
	public partyStatusLabel: KnockoutComputed<string>;
	public evolutionChainText: KnockoutComputed<string | null>;
	public evolutionProgressText: KnockoutComputed<string | null>;

	constructor(
		species: SpeciesDef,
		caughtCount: number,
		isSeen: boolean,
		currentHp: number,
		manager: DexManager,
	)
	{
		this.species = species;
		this.manager = manager;

		this.caughtCount = ko.observable(caughtCount);
		this.isSeen = ko.observable(isSeen);
		this.currentHp = ko.observable(currentHp);

		this.isCaught = ko.pureComputed(() => this.caughtCount() > 0);

		this.isDiscovered = ko.pureComputed(() => this.isSeen() || this.isCaught());

		this.displayName = ko.pureComputed(() =>
			this.isDiscovered() ? this.species.name : "???"
		);

		this.isInParty = ko.pureComputed(() =>
			this.manager.isInParty(this.species.id)
		);

		this.hpPercent = ko.pureComputed(() =>
			Math.round((this.currentHp() / this.species.base.hp) * 100)
		);

		this.resolvedMoves = species.moveIds.map(id => MoveLibrary[id]).filter(Boolean);
		this.resolvedUltimate = species.ultimateId ? UltimateLibrary[species.ultimateId] ?? null : null;
		this.evolvesFromSpecies = species.evolvesFrom ? CreatureDex[species.evolvesFrom] ?? null : null;
		this.evolvesToSpecies = (Object.values(CreatureDex) as SpeciesDef[])
			.find(candidate => candidate.evolvesFrom === species.id) ?? null;

		this.hasBackSprite = ko.pureComputed(() => this.isCaught() && !!this.species.behindImage);

		this.detailSpriteSrc = ko.pureComputed(() =>
		{
			if (!this.isCaught()) return this.species.portraitImage ?? null;
			if (this.manager.detailSpriteMode() === "rear" && this.species.behindImage) return this.species.behindImage;
			return this.species.portraitImage ?? this.species.behindImage ?? null;
		});

		this.detailTags = ko.pureComputed(() =>
		{
			const tags: string[] = [];

			if (this.evolvesFromSpecies) tags.push("Unlock Form");
			else if (this.evolvesToSpecies) tags.push("Base Form");

			if (this.species.portalUnlock === "after_secret_defeated")
			{
				tags.push("Imported");
				tags.push("Postgame");
			}

			if (this.resolvedUltimate) tags.push("Ultimate");
			if (this.isInParty()) tags.push("Active Party");

			return tags;
		});

		this.partyStatusLabel = ko.pureComputed(() =>
			this.isInParty() ? "Active" : "Standby"
		);

		this.evolutionChainText = ko.pureComputed(() =>
		{
			if (this.evolvesFromSpecies) return `${this.evolvesFromSpecies.name} -> ${this.species.name}`;
			if (this.evolvesToSpecies) return `${this.species.name} -> ${this.evolvesToSpecies.name}`;
			return null;
		});

		this.evolutionProgressText = ko.pureComputed(() =>
		{
			if (!this.isCaught() || !this.evolvesToSpecies) return null;

			if (this.manager.cache.caughtCreatures[this.evolvesToSpecies.id]) return "Unlock path complete.";
			if (this.manager.cache.pendingEvolutions.includes(this.evolvesToSpecies.id))
			{
				return "Unlock detected in nearby portals.";
			}

			const progress = Math.min(this.manager.cache.battleCounts[this.species.id] || 0, DEX_EVOLUTION_THRESHOLD);
			return `${progress}/${DEX_EVOLUTION_THRESHOLD} battle cycles logged toward unlocking ${this.evolvesToSpecies.name}.`;
		});
	}
}

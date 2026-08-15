import { SpeciesDef, CreatureDex } from "./data/CreatureList";

/**
 * Lightweight UI-state manager for the Battle Simulator overlay.
 * Handles creature selection for the sprite viewer and battle sim.
 * No cache or dex dependency - pure UI state.
 */
export class SimManager
{
	/** All creatures from the dex, sorted alphabetically by name */
	public allCreatures: SpeciesDef[];

	/** Sprite viewer: currently previewed creature */
	public previewCreature: KnockoutObservable<SpeciesDef | null> = ko.observable(null);

	/** Battle sim: player's creature pick */
	public playerPick: KnockoutObservable<SpeciesDef | null> = ko.observable(null);

	/** Battle sim: enemy creature pick */
	public enemyPick: KnockoutObservable<SpeciesDef | null> = ko.observable(null);

	/** True when both player and enemy are selected */
	public canLaunch: KnockoutComputed<boolean>;

	private onLaunch: () => void;

	constructor(onLaunch: () => void)
	{
		this.onLaunch = onLaunch;

		this.allCreatures = Object.values(CreatureDex)
			.sort((a, b) => a.name.localeCompare(b.name));

		this.canLaunch = ko.pureComputed(() =>
			this.playerPick() !== null && this.enemyPick() !== null
		);
	}

	public setPreview = (species: SpeciesDef): void =>
	{
		this.previewCreature(species);
	};

	public setPlayer = (species: SpeciesDef): void =>
	{
		this.playerPick(species);
	};

	public setEnemy = (species: SpeciesDef): void =>
	{
		this.enemyPick(species);
	};

	public launchBattle = (): void =>
	{
		if (!this.canLaunch()) return;
		this.onLaunch();
	};
}

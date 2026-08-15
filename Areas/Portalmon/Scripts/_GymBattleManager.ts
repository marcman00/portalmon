import { SpeciesId } from "./data/CreatureList";
import { TrainerDefs } from "./data/TrainerList";
import { CombatManager } from "./_CombatManager";
import { PortalmonCache } from "./PortalmonController";
import { SoundHandler } from "./SoundManager";

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

interface GymBattleStateData
{
	version?: number;
	defeats: Record<string, boolean>;
	championDefeated: boolean;
	secretDefeated: boolean;
}

class GymBattleState
{
	private static readonly _key = "PortalmonGym";
	private static readonly _version = 1;

	public defeats: Record<string, boolean>;
	public championDefeated: boolean;
	public secretDefeated: boolean;

	constructor(data?: GymBattleStateData)
	{
		this.defeats = data?.defeats ?? {};
		this.championDefeated = data?.championDefeated ?? false;
		this.secretDefeated = data?.secretDefeated ?? false;
	}

	public static load(): GymBattleState
	{
		try
		{
			const raw = localStorage.getItem(GymBattleState._key);
			if (raw)
			{
				const data = JSON.parse(raw) as GymBattleStateData;
				if (data.version === GymBattleState._version) return new GymBattleState(data);
			}
		}
		catch { /* ignore */ }
		return new GymBattleState();
	}

	public save(): void
	{
		localStorage.setItem(GymBattleState._key, JSON.stringify({
			version: GymBattleState._version,
			defeats: this.defeats,
			championDefeated: this.championDefeated,
			secretDefeated: this.secretDefeated,
		}));
	}
}

// ---------------------------------------------------------------------------
// GymLeader view model
// ---------------------------------------------------------------------------

export interface GymLeaderDef
{
	id: string;
	name: string;
	party: SpeciesId[];
	defeatQuote: string;
	winQuote?: string;
	portraitImage?: string;
	battleImage?: string;
	philosophy?: string;
	badgeImage?: string;
	specialty?: string;
	portraitEmoji?: string;
	creatureEmojis?: string[];
}

/**
 * Championship and secret-boss battles are GymLeaderDefs plus a header label
 * (and, for the secret boss, a name/subtitle that's only revealed on unlock).
 */
export interface BossDef extends GymLeaderDef
{
	/** Display label shown in the encounter header during this battle */
	battleLabel: string;
	/** Revealed name for the secret boss (shown once championship is beaten) */
	revealedName?: string;
	/** Subtitle shown on the secret card */
	subtitle?: string;
}

export class GymLeaderVM
{
	public readonly id: string;
	public readonly name: string;
	public readonly specialty: string;
	public readonly portraitEmoji: string;
	public readonly creatureEmojis: string[];
	public readonly party: SpeciesId[];
	public readonly defeatQuote: string;
	public readonly winQuote: string;
	public readonly portraitImage: string;
	public readonly battleImage: string;
	public readonly philosophy: string;
	public readonly badgeImage: string;
	public isDefeated: KnockoutObservable<boolean>;

	constructor(def: GymLeaderDef, defeated: boolean)
	{
		this.id = def.id;
		this.name = def.name;
		this.specialty = def.specialty ?? "";
		this.portraitEmoji = def.portraitEmoji ?? "\u2753";
		this.creatureEmojis = def.creatureEmojis ?? [];
		this.party = def.party;
		this.defeatQuote = def.defeatQuote;
		this.winQuote = def.winQuote ?? "";
		this.portraitImage = def.portraitImage ?? "";
		this.battleImage = def.battleImage ?? "";
		this.philosophy = def.philosophy ?? "";
		this.badgeImage = def.badgeImage ?? "";
		this.isDefeated = ko.observable(defeated);
	}
}

// ---------------------------------------------------------------------------
// Gym leader definitions  (edit these to match your actual creature IDs)
// ---------------------------------------------------------------------------

const GYM_LEADER_DEFS: GymLeaderDef[] = Object.values(TrainerDefs)
	.filter(trainer => trainer.role === "gym")
	.map(trainer => ({
		id: trainer.id,
		name: trainer.name,
		party: trainer.party,
		defeatQuote: trainer.victoryMessage,
		winQuote: trainer.winQuote,
		portraitImage: trainer.portraitImage,
		battleImage: trainer.battleImage,
		philosophy: trainer.philosophy,
		badgeImage: trainer.badgeImage,
		specialty: trainer.specialty,
	}));

const CHAMPIONSHIP_DEF: BossDef = {
	id: "champion", name: TrainerDefs["glados"].name,
	party: TrainerDefs["glados"].party,
	defeatQuote: TrainerDefs["glados"].victoryMessage,
	winQuote: TrainerDefs["glados"].winQuote,
	portraitImage: TrainerDefs["glados"].portraitImage,
	battleImage: TrainerDefs["glados"].battleImage,
	philosophy: TrainerDefs["glados"].philosophy,
	badgeImage: TrainerDefs["glados"].badgeImage,
	battleLabel: "Championship Battle: GLaDOS",
};

const SECRET_DEF: BossDef = {
	id: "secret", name: "???",
	revealedName: "Rey",
	subtitle: "Developer signature detected. Location unknown.",
	portraitEmoji: "\uD83D\uDD75\uFE0F",
	party: TrainerDefs["rey"].party,
	defeatQuote: TrainerDefs["rey"].victoryMessage,
	winQuote: TrainerDefs["rey"].winQuote,
	portraitImage: TrainerDefs["rey"].portraitImage,
	battleImage: TrainerDefs["rey"].battleImage,
	philosophy: TrainerDefs["rey"].philosophy,
	badgeImage: TrainerDefs["rey"].badgeImage,
	battleLabel: "Developer Battle: Rey",
};

// ---------------------------------------------------------------------------
// GymBattleManager
// ---------------------------------------------------------------------------

/**
 * Callback invoked by GymBattleManager to hand control to the Encounter tab.
 * PortalKombatManager supplies this to wire up the tab switch.
 */
export type GymBattleReadyCallback = (label: string) => void;

export class GymBattleManager
{
	public cache: PortalmonCache;

	/** Array of gym leader view models */
	public gymLeaders: KnockoutObservableArray<GymLeaderVM>;
	/** Physical gym slot selected from town; independent from leader identity. */
	public readonly focusedGymSlot: KnockoutObservable<number | null> = ko.observable(null);

	/** True once every gym leader has been defeated at least once */
	public isChampionshipUnlocked: KnockoutComputed<boolean>;

	/** True once the Championship has been defeated */
	public isChampionshipDefeated: KnockoutObservable<boolean>;

	/** Display name of the final champion */
	public readonly championName: string = CHAMPIONSHIP_DEF.name;
	public readonly championPortraitImage: string = CHAMPIONSHIP_DEF.portraitImage ?? "";
	public readonly championPhilosophy: string = CHAMPIONSHIP_DEF.philosophy ?? "";
	public readonly championBadgeImage: string = CHAMPIONSHIP_DEF.badgeImage ?? "";
	public readonly secretPortraitImage: string = SECRET_DEF.portraitImage ?? "";
	public readonly secretBadgeImage: string = SECRET_DEF.badgeImage ?? "";

	// Badge modal
	public badgeModalVisible = ko.observable(false);
	public badgeModalImage = ko.observable("");
	public badgeModalTitle = ko.observable("");
	public badgeModalDesc = ko.observable("");

	public showBadge = (leader: GymLeaderVM): void =>
	{
		if (!leader.isDefeated() || !leader.badgeImage) return;
		this.badgeModalImage(leader.badgeImage);
		this.badgeModalTitle(`${leader.specialty || "Gym"} Badge`);
		this.badgeModalDesc(`Received by defeating ${leader.name}.`);
		this.badgeModalVisible(true);
	};

	public showBadgeFor = (trainerId: string): void =>
	{
		if (trainerId === "glados" && this.isChampionshipDefeated())
		{
			this.badgeModalImage(this.championBadgeImage);
			this.badgeModalTitle("Champion Badge");
			this.badgeModalDesc("Received by defeating GLaDOS and completing the simulation.");
			this.badgeModalVisible(true);
		}
		else if (trainerId === "rey" && this.isSecretDefeated())
		{
			this.badgeModalImage(this.secretBadgeImage);
			this.badgeModalTitle("Developer Badge");
			this.badgeModalDesc("Received by finding and defeating Rey.");
			this.badgeModalVisible(true);
		}
	};

	public closeBadgeModal = (): void =>
	{
		this.badgeModalVisible(false);
	};

	/** True once the Championship is defeated, revealing the secret battle */
	public isSecretUnlocked: KnockoutComputed<boolean>;
	public isSecretDefeated: KnockoutObservable<boolean>;

	public readonly secretName: string = SECRET_DEF.revealedName;
	public readonly secretSubtitle: string = SECRET_DEF.subtitle;
	public readonly secretPortraitEmoji: string = SECRET_DEF.portraitEmoji;

	private gymState: GymBattleState;
	private readonly combatManager: CombatManager;
	private readonly onReady: GymBattleReadyCallback;

	private soundHandler: SoundHandler;

	/**
	 * Set by PortalmonController after construction.
	 * Fired when the championship is won.
	 */
	public onChampionshipVictory: (() => void) | null = null;
	public onSecretVictory: (() => void) | null = null;
	public onChampionshipUnlocked: (() => void) | null = null;

	constructor(cache: PortalmonCache, combatManager: CombatManager, onReady: GymBattleReadyCallback, soundHandler: SoundHandler)
	{
		this.cache = cache;
		this.combatManager = combatManager;
		this.onReady = onReady;
		this.gymState = GymBattleState.load();
		this.soundHandler = soundHandler;

		// Build leader VMs from persisted state
		this.gymLeaders = ko.observableArray(
			GYM_LEADER_DEFS.map(def => new GymLeaderVM(def, !!this.gymState.defeats[def.id]))
		);

		this.isChampionshipUnlocked = ko.pureComputed(() =>
			this.gymLeaders().every(l => l.isDefeated())
		);

		this.isChampionshipDefeated = ko.observable(this.gymState.championDefeated);

		this.isSecretDefeated = ko.observable(this.gymState.secretDefeated);
		this.isSecretUnlocked = ko.pureComputed(() =>
			this.isChampionshipDefeated()
		);
	}

	// -----------------------------------------------------------------------
	// Battle triggers (called from Battles.cshtml buttons)
	// -----------------------------------------------------------------------

	public startGymBattle = (leader: GymLeaderVM): void =>
	{
		if (this.combatManager.isInActiveBattle()) return;
		if (this.cache.selectedParty.length === 0) return;
		const label = `Gym Battle: ${leader.name}`;
		this.soundHandler.playGymMusic();
		this.combatManager.beginGymBattle(
			leader.party, label, leader.name, leader.defeatQuote,
			() => this._markGymDefeated(leader.id),
			leader.portraitImage, leader.battleImage, leader.id,
		);
		this.onReady(label);
	};

	/** Start a leader battle from a map Actable. Map dialogue supplies the victory line. */
	public startMapTrainerBattle = (trainerId: string, afterBattleMessage: string): boolean =>
	{
		if (trainerId === "rey") return this.startSecretBattle();

		const leader = this.gymLeaders().find(candidate => candidate.id === trainerId);
		if (!leader || leader.isDefeated() || this.combatManager.isInActiveBattle() || this.cache.selectedParty.length === 0)
			return false;
		if (!afterBattleMessage.trim()) return false;

		const label = `Gym Battle: ${leader.name}`;
		this.soundHandler.playGymMusic();
		this.combatManager.beginGymBattle(
			leader.party, label, leader.name, afterBattleMessage,
			() => this._markGymDefeated(leader.id),
			leader.portraitImage, leader.battleImage, leader.id, false,
		);
		this.onReady(label);
		return true;
	};

	public isTrainerDefeated = (trainerId: string): boolean =>
	{
		if (trainerId === "glados") return this.isChampionshipDefeated();
		if (trainerId === "rey") return this.isSecretDefeated();
		return !!this.gymState.defeats[trainerId];
	};

	public startChampionshipBattle = (): void =>
	{
		if (!this.isChampionshipUnlocked()) return;
		if (this.combatManager.isInActiveBattle()) return;
		if (this.cache.selectedParty.length === 0) return;
		this.soundHandler.playChampionMusic();
		this.combatManager.beginGymBattle(
			CHAMPIONSHIP_DEF.party,
			CHAMPIONSHIP_DEF.battleLabel,
			CHAMPIONSHIP_DEF.name,
			CHAMPIONSHIP_DEF.defeatQuote,
			() => this._markChampionDefeated(),
			CHAMPIONSHIP_DEF.portraitImage, CHAMPIONSHIP_DEF.battleImage, "glados",
		);
		this.onReady(CHAMPIONSHIP_DEF.battleLabel);
	};

	public startSecretBattle = (): boolean =>
	{
		if (!this.isSecretUnlocked()) return false;
		if (this.isSecretDefeated()) return false;
		if (this.combatManager.isInActiveBattle()) return false;
		if (this.cache.selectedParty.length === 0) return false;
		this.soundHandler.playBossMusic();
		this.combatManager.beginGymBattle(
			SECRET_DEF.party,
			SECRET_DEF.battleLabel,
			SECRET_DEF.revealedName,
			SECRET_DEF.defeatQuote,
			() => this._markSecretDefeated(),
			SECRET_DEF.portraitImage, SECRET_DEF.battleImage, "rey",
		);
		this.onReady(SECRET_DEF.battleLabel);
		return true;
	};

	// -----------------------------------------------------------------------
	// Victory handlers (called back by CombatManager on win)
	// -----------------------------------------------------------------------

	private _markGymDefeated(leaderId: string): void
	{
		const wasUnlocked = this.isChampionshipUnlocked();
		const leader = this.gymLeaders().find(l => l.id === leaderId);
		if (leader && !leader.isDefeated())
		{
			leader.isDefeated(true);
		}
		this.gymState.defeats[leaderId] = true;
		this.gymState.save();
		if (!wasUnlocked && this.isChampionshipUnlocked()) this.onChampionshipUnlocked?.();
	}

	private _markChampionDefeated(): void
	{
		this.isChampionshipDefeated(true);
		this.gymState.championDefeated = true;
		this.gymState.save();
		this.onChampionshipVictory?.();
	}

	private _markSecretDefeated(): void
	{
		this.gymState.secretDefeated = true;
		this.isSecretDefeated(true);
		this.gymState.save();
		this.onSecretVictory?.();
	}
}

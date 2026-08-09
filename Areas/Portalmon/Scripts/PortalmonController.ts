import { CombatManager } from "./_CombatManager";
import { DexManager } from "./_DexManager";
import { CreatureDex, SpeciesDef, SpeciesId } from "./data/CreatureList";
import { GymBattleManager, GymBattleReadyCallback } from "./_GymBattleManager";
import { SoundHandler } from "./SoundManager";
import { CatchAnimator } from "./CatchAnimator";
import { SimManager } from "./_SimManager";
import { BattleTransition, TransitionColor } from "./BattleTransition";
import { OverworldManager } from "./OverworldManager";
import { FAINT_RECOVERY_DESTINATION } from "./overworld/RecoveryDestination";
import { MapWarpDef, OverworldMapId } from "./overworld/OverworldMapTypes";
import { wait } from "./HelperFunctions";

type GameboySkin = "purple" | "aqua" | "pikachu" | "mooroo" | "isaac";

interface GameboySkinOption
{
	id: GameboySkin;
	label: string;
}

const GAMEBOY_SKIN_OPTIONS: ReadonlyArray<GameboySkinOption> = [
	{ id: "purple", label: "Purple" },
	{ id: "aqua", label: "Aqua" },
	{ id: "pikachu", label: "Pikachu Yellow" },
	{ id: "mooroo", label: "Mooroo" },
	{ id: "isaac", label: "The Blinding of Isaac: Pink" },
];

function isGameboySkin(value: unknown): value is GameboySkin
{
	return GAMEBOY_SKIN_OPTIONS.some(option => option.id === value);
}

class PortalmonController
{
	/** Cache for storing data across pages. Provides continuity. */
	public cache: PortalmonCache;

	/**
	 * Manages combat
	 */
	public combatManager: CombatManager;

	/**
	 * Manages the Dex
	 */
	public dexManager: DexManager;

	/**
	 * Manages the Gym Battle page
	 */
	public gymBattleManager: GymBattleManager;

	public soundHandler: SoundHandler;
	public catchAnim: CatchAnimator;
	public simManager: SimManager;
	public battleTransition: BattleTransition;
	public overworldManager: OverworldManager;

	public isSoundEnabled: KnockoutObservable<boolean> = ko.observable(true);

	/** Dev override for early sim access via ?sim */
	private readonly hasSimDevOverride: boolean = new URLSearchParams(window.location.search).has("sim");

	/** Sim unlocks after defeating GLaDOS, but ?sim still forces it on for dev */
	public isSimUnlocked: KnockoutComputed<boolean>;

	/**
	 * If true, we are actively in an encounter (and combatManager is most active)
	 */
	public inEncounter: KnockoutObservable<boolean> = ko.observable(false);
	/** Covers a full-party wipe while the game restores and returns the player. */
	public isRecoveringFromFaint: KnockoutObservable<boolean> = ko.observable(false);
	public faintRecoveryMessage: KnockoutObservable<string> = ko.observable("");

	/**
	 * The player's trainer name. New saves use Test Subject; it can be changed in Settings.
	 */
	public trainerName: KnockoutObservable<string> = ko.observable("Test Subject");
	/** Editing buffer for the start-menu name change */
	public pendingTrainerName: KnockoutObservable<string> = ko.observable("");

	// =========================================================================
	// POWER-ON SEQUENCE
	// =========================================================================

	/**
	 * True once the device has been powered on (click-to-on and logo have passed).
	 * All game content is hidden until this is true.
	 */
	public isPoweredOn: KnockoutObservable<boolean> = ko.observable(false);

	/**
	 * True while the logo splash is showing (between clicking "power on" and
	 * the game content appearing).
	 */
	public isShowingLogo: KnockoutObservable<boolean> = ko.observable(false);

	/** True while the first-person blink overlay introduces the lab. */
	public isLabWakeActive: KnockoutObservable<boolean> = ko.observable(false);
	private pendingLabSummons: boolean = false;
	private labWakeTimer: number | null = null;

	/**
	 * Label displayed at the top of the Encounter tab during a trainer battle.
	 * Empty when it's a normal wild encounter.
	 */
	public battleContext: KnockoutObservable<string> = ko.observable("");

	/**
	 * Currently active overlay: 'none' | 'dex' | 'gym' | 'info'
	 */
	public activeOverlay: KnockoutObservable<string> = ko.observable("none");
	public readonly gameboySkinOptions: ReadonlyArray<GameboySkinOption> = GAMEBOY_SKIN_OPTIONS;
	public gameboySkin: KnockoutObservable<GameboySkin> = ko.observable("purple");
	public currentGameboySkinLabel: KnockoutComputed<string> = ko.pureComputed(() =>
		this.gameboySkinOptions.find(option => option.id === this.gameboySkin())?.label ?? "Purple"
	);

	/**
	 * True while the championship victory screen is showing.
	 */
	public isShowingVictoryScreen: KnockoutObservable<boolean> = ko.observable(false);
	public isShowingCredits: KnockoutObservable<boolean> = ko.observable(false);

	/** Current battery level (0–100) */
	public batteryPercent: KnockoutObservable<number> = ko.observable(100);

	/** Temporary status toast for dex sync events */
	public _statusToast: KnockoutObservable<string> = ko.observable("");

	/** True when the battery is fully depleted and recharging */
	public isBatteryDepleted: KnockoutComputed<boolean>;

	/** The current depleted-screen message (randomly selected when battery hits 0) */
	public depletedMessage: KnockoutObservable<{ text: string; showGlados: boolean }> = ko.observable({ text: "", showGlados: false });

	constructor()
	{
		this.cache = new PortalmonCache();
		this.gameboySkin(this.cache.gameboySkin);

		// Restore persisted trainer name if it exists
		if (this.cache.trainerName)
		{
			this.trainerName(this.cache.trainerName);
		}

		this.soundHandler = new SoundHandler(this.cache.soundEnabled);
		this.dexManager = new DexManager(this.cache);
		this.combatManager = new CombatManager(this.cache, this.dexManager, this.soundHandler);
		this.catchAnim = new CatchAnimator();
		this.battleTransition = new BattleTransition();
		this.overworldManager = new OverworldManager(
			() => this.isOverworldScreenActive(),
			() => void this.useEnrichmentCenter(),
			(gymSlot: number) => this.openTownGym(gymSlot),
			() => this.startWildEncounter(),
			(trainerId: string, afterBattleMessage: string) => this.gymBattleManager.startMapTrainerBattle(trainerId, afterBattleMessage),
			(trainerId: string) => this.gymBattleManager.isTrainerDefeated(trainerId),
			(trainerId: string) => trainerId !== "rey" || this.gymBattleManager.isSecretUnlocked(),
			(scriptId: string) => this.runOverworldScript(scriptId),
			(sourceMapId: OverworldMapId, warp: MapWarpDef) => this.resolveOverworldWarp(sourceMapId, warp),
		);

		

		// The ready callback is invoked by GymBattleManager after it calls beginGymBattle.
		// Its only job is to update the UI context label and close overlays to show combat.
		const onGymBattleReady: GymBattleReadyCallback = async (label) =>
		{
			if (this.battleTransition.isPlaying()) return;
			// beginGymBattle has already run, so the trainer and the whole enemy
			// party are known and their art can be warmed during the transition.
			await this.battleTransition.play("gold", () =>
			{
				this.battleContext(label);
				this.inEncounter(true);
				this.activeOverlay("none");
			}, [...this.combatManager.enemyArtSources(), ...this.combatManager.partyArtSources()]);
		};

		this.gymBattleManager = new GymBattleManager(this.cache, this.combatManager, onGymBattleReady, this.soundHandler);
		this.simManager = new SimManager(() => this.launchSimBattle());
		this.isSimUnlocked = ko.pureComputed(() =>
			this.hasSimDevOverride || this.gymBattleManager.isChampionshipDefeated()
		);
		// Wire the dex battle guard so party changes are blocked during active combat
		this.dexManager.isInActiveBattle = this.combatManager.isInActiveBattle;

		// Keep the combat party in sync when the player changes their party in the Dex screen
		this.dexManager.selectedParty.subscribe(() => this.combatManager.reloadParty());

		// Wire evolution callback — fires after every win/catch/gym-win
		this.combatManager.onBattleWon = () => this.checkEvolutions();

		// Reset encounter state when the player dismisses the result screen.
		this.combatManager.onBattleDismissed = () =>
		{
			this.catchAnim.reset();
			this.drainBattery();
			this.inEncounter(false);
			if (this.pendingLabSummons)
			{
				this.pendingLabSummons = false;
				window.setTimeout(() => this.overworldManager.dialogue.open({
					speaker: "GLaDOS",
					lines: ["Attention, Test Subject. You have exhausted the educational value of my middle management. Return to the lab for your final evaluation."],
				}), 150);
			}
		};
		this.combatManager.onPartyWiped = () => void this.recoverFromFaint();

		// Show the victory screen when the championship is won
		this.gymBattleManager.onChampionshipVictory = () => this.showVictoryScreen();
		this.gymBattleManager.onSecretVictory = () =>
		{
			this._statusToast("Secret boss defeated. Developer containment successful.");
			window.setTimeout(() => this._statusToast(""), 3000);
		};
		this.gymBattleManager.onChampionshipUnlocked = () => { this.pendingLabSummons = true; };
		document.addEventListener("keydown", event =>
		{
			if (this.isLabWakeActive() && ["enter", " ", "e"].includes(event.key.toLowerCase()))
			{
				event.preventDefault();
				this.skipLabWake();
			}
		});

		this.isBatteryDepleted = ko.pureComputed(() => this.batteryPercent() <= 0);
		this.initBattery();
	}

	// =========================================================================
	// POWER-ON SEQUENCE
	// =========================================================================

	/**
	 * Called when the player clicks the "Click to turn on" screen.
	 * Plays the startup sound, shows the logo for ~3 s, then enters the game.
	 */
	public powerOn = (): void =>
	{
		this.isShowingLogo(true);

		this.soundHandler.playOnSound();
		// Power-on is the first user gesture and the logo holds the screen for
		// several seconds, which is the right moment to fetch the effects the
		// player will hit first. Doing it earlier would compete with page load.
		this.soundHandler.preloadCoreEffects();

		// Give the logo ~3 seconds of screen time before entering the game.
		// Increase the timeout if the sound is longer than 3 s.
		setTimeout(() =>
		{
			this.isShowingLogo(false);
			this.isPoweredOn(true);

			this.soundHandler.playBackgroundMusic();
			if (!this.cache.hasCompletedLabIntro)
			{
				this.overworldManager.teleportToSpawn("lab", "lab-start");
				if (!this.cache.hasChosenStarter) this.beginLabWakeSequence();
				else window.setTimeout(() => this.overworldManager.dialogue.open({
					speaker: "GLaDOS",
					lines: ["You already selected a Portalmon. Against the odds, your short-term memory is operational. The exit is now available."],
				}), 250);
			}
		}, 5000);
	};

	/** Determines whether a species can appear in a random wild encounter. */
	private isEligibleForWildEncounter = (species: SpeciesDef): boolean =>
	{
		const portalUnlock = species.portalUnlock ?? "always";
		if (portalUnlock === "after_champion_defeated" && !this.gymBattleManager.isChampionshipDefeated())
			return false;

		return !species.evolvesFrom
			|| !!this.cache.caughtCreatures[species.id]
			|| this.cache.pendingEvolutions.includes(species.id);
	};

	/** Battles won/caught while a creature is in the party to unlock its evolution */
	private static readonly BATTLES_TO_EVOLVE = 3;
	/** Maximum encounters on a full battery */
	private static readonly MAX_ENCOUNTERS = 10;
	/** Battery drain per encounter (percentage points) */
	private static readonly DRAIN_PER_ENCOUNTER = 100 / PortalmonController.MAX_ENCOUNTERS;
	/** Recharge interval: gain one segment every (60/MAX_ENCOUNTERS) minutes */
	private static readonly RECHARGE_INTERVAL_MS = (60 / PortalmonController.MAX_ENCOUNTERS) * 60 * 1000;
	/** Battery only drains during work hours (9 AM to 5 PM) */
	private static isWorkHours = (): boolean => { const h = new Date().getHours(); return h >= 9 && h < 17; };

	/**
	 * Called after every won battle or successful catch via onBattleWon.
	 * Increments battle counts for all party members, checks thresholds,
	 * queues evolved forms, and appends flavour text to footerHint.
	 */
	private checkEvolutions = (): void =>
	{
		const newLines: string[] = [];

		for (const speciesId of this.cache.selectedParty)
		{
			const count = this.cache.incrementBattleCount(speciesId);
			if (count !== PortalmonController.BATTLES_TO_EVOLVE) continue;

			const evolved = (Object.values(CreatureDex) as SpeciesDef[])
				.find(s => s.evolvesFrom === speciesId);
			if (!evolved) continue;

			this.cache.addPendingEvolution(evolved.id);

			newLines.push(`${evolved.name} has been cleared for deployment and added to the encounter pool.`);
		}

		this.cache.saveCache();

		if (newLines.length === 0) return;

		this.combatManager.announcerLine(newLines.join(" · "));
		this.combatManager.footerHint(`New encounter tier${newLines.length > 1 ? "s" : ""} unlocked — watch for ${newLines.length > 1 ? "them" : "it"} in wild areas.`);
	};

	public toggleSound = (): void =>
	{
		const enabled = this.soundHandler.toggleSound();
		this.isSoundEnabled(enabled);
		this.cache.soundEnabled = enabled;
		this.cache.saveCache();
	};

	/**
	 * Starts a wild encounter with the species the player clicked on.
	 *
	 *     Add a public method  beginEncounterWith(speciesId: SpeciesId): void
	 *     that forces the enemy to be that specific species instead of picking
	 *     one at random.  The rest of the battle setup (HP, moves, etc.) should
	 *     work identically to beginEncounter().
	 */

	private _batteryTimer: ReturnType<typeof setInterval> | null = null;

	/**
	 * Initialises battery state from cache.
	 * Applies any recharge that accrued while the page was closed, then starts the tick.
	 */
	private initBattery = (): void =>
	{
		// Apply offline recharge
		if (this.cache.lastRechargeTime > 0 && this.cache.batteryPercent < 100)
		{
			const elapsed = Date.now() - this.cache.lastRechargeTime;
			const segments = Math.floor(elapsed / PortalmonController.RECHARGE_INTERVAL_MS);
			if (segments > 0)
			{
				this.cache.batteryPercent = Math.min(100, this.cache.batteryPercent + segments * PortalmonController.DRAIN_PER_ENCOUNTER);
				this.cache.lastRechargeTime = Date.now();
				this.cache.saveCache();
			}
		}
		this.batteryPercent(this.cache.batteryPercent);
		if (this.cache.batteryPercent <= 0) this.pickDepletedMessage();
		this.startBatteryTick();
	};

	/**
	 * Drains the battery by one segment after an encounter (work hours only).
	 */
	private static readonly DEPLETED_MESSAGES: { text: string; showGlados: boolean }[] = [
		// GLaDOS taunts
		{ text: "The Enrichment Center reminds you that productivity is its own reward. The portals will reopen shortly.", showGlados: true },
		{ text: "I'm not saying you've been playing too much. I'm saying HR has a dashboard.", showGlados: true },
		{ text: "This was a triumph. I'm making a note here: battery depleted.", showGlados: true },
		{ text: "I could recharge this faster, but watching you wait builds character.", showGlados: true },
		{ text: "The battery died doing what it loved: powering your procrastination.", showGlados: true },
		{ text: "Fun fact: every minute you spend here, a QAN ages one hour. That's not true. But it felt true, didn't it?", showGlados: true },
		// System-flavored humor
		{ text: "Power reserves critically low. Estimated restoration: soon.", showGlados: false },
		{ text: "Rate limit exceeded. This is what happens when you catch 'em all before lunch.", showGlados: false },
		{ text: "The battery is recharging. This is a feature, not a bug.", showGlados: false },
		// Fourth-wall breaks
		{ text: "You've used all your encounters. Time passes. The battery charges. Such is the great cycle.", showGlados: false },
		{ text: "No Power. Your Portalmon miss you too. They'll be here when the battery's ready.", showGlados: false },
		{ text: "Battery depleted. Your Portalmon have been placed in low-power mode. They're dreaming about type advantages.", showGlados: false },
	];

	private pickDepletedMessage = (): void =>
	{
		const msgs = PortalmonController.DEPLETED_MESSAGES;
		const msg = msgs[Math.floor(Math.random() * msgs.length)];
		this.depletedMessage(msg);
	};

	private drainBattery = (): void =>
	{
		if (!PortalmonController.isWorkHours()) return;

		const newPct = Math.max(0, this.cache.batteryPercent - PortalmonController.DRAIN_PER_ENCOUNTER);
		this.cache.batteryPercent = newPct;
		if (newPct < 100) this.cache.lastRechargeTime = this.cache.lastRechargeTime || Date.now();
		this.cache.saveCache();
		this.batteryPercent(newPct);
		if (newPct <= 0) this.pickDepletedMessage();
	};

	/**
	 * Ticks every second to apply gradual recharge.
	 */
	private startBatteryTick = (): void =>
	{
		if (this._batteryTimer) clearInterval(this._batteryTimer);

		this._batteryTimer = setInterval(() =>
		{
			if (this.cache.batteryPercent >= 100)
			{
				this.cache.lastRechargeTime = 0;
				this.cache.saveCache();
				this.batteryPercent(100);
				return;
			}

			if (this.cache.lastRechargeTime <= 0) return;

			const elapsed = Date.now() - this.cache.lastRechargeTime;
			if (elapsed >= PortalmonController.RECHARGE_INTERVAL_MS)
			{
				const segments = Math.floor(elapsed / PortalmonController.RECHARGE_INTERVAL_MS);
				const newPct = Math.min(100, this.cache.batteryPercent + segments * PortalmonController.DRAIN_PER_ENCOUNTER);
				this.cache.batteryPercent = newPct;
				this.cache.lastRechargeTime = Date.now();
				this.cache.saveCache();
				this.batteryPercent(newPct);

			}
		}, 1000);
	};

	private initiateWildEncounter = async (species: SpeciesDef, portalColor: TransitionColor = "blue"): Promise<void> =>
	{
		if (this.cache.selectedParty.length === 0) return;
		if (this.combatManager.playerParty().every(p => p.isFainted())) return;
		if (this.battleTransition.isPlaying()) return; // prevent double-click during transition
		if (this.isBatteryDepleted()) return;

		this.soundHandler.stopBackgroundMusic();
		this.soundHandler.playBattleStartSound();
		// The start sound chains into battle music when it ends, and that track
		// is created with preload='none'. Warming it now means the download
		// happens during the transition instead of after the sting finishes.
		this.soundHandler.warmUpBattleMusic();

		await this.battleTransition.play(portalColor, () =>
		{
			this.combatManager.beginEncounterWith(species.id);
			this.inEncounter(true);
		}, [species.portraitImage, ...this.combatManager.partyArtSources()]);
	};

	/** Fully restores a wiped party and returns it to the configured Enrichment Center point. */
	private recoverFromFaint = async (): Promise<void> =>
	{
		if (this.isRecoveringFromFaint()) return;
		this.isRecoveringFromFaint(true);
		this.faintRecoveryMessage("All Portalmon fainted. Returning to the Enrichment Center…");

		await wait(550);
		this.combatManager.dismissBattle();
		this.healPartyToFull();
		this.overworldManager.teleportTo(FAINT_RECOVERY_DESTINATION);
		await wait(250);
		this.isRecoveringFromFaint(false);
		this.faintRecoveryMessage("");
	};

	/** Restores the party after interacting with the Enrichment Center door. */
	private useEnrichmentCenter = async (): Promise<void> =>
	{
		if (this.isRecoveringFromFaint()) return;
		this.isRecoveringFromFaint(true);
		this.faintRecoveryMessage("Enrichment Center: restoring your Portalmon…");

		await wait(450);
		this.healPartyToFull();
		await wait(250);
		this.isRecoveringFromFaint(false);
		this.faintRecoveryMessage("");
	};

	/** Starts a random battle from an overworld Wild zone. */
	public startWildEncounter = (): boolean =>
	{
		if (this.cache.selectedParty.length === 0) return false;
		if (this.combatManager.playerParty().every(p => p.isFainted())) return false;
		if (this.battleTransition.isPlaying() || this.isBatteryDepleted()) return false;

		const candidates = (Object.values(CreatureDex) as SpeciesDef[])
			.filter(species => this.isEligibleForWildEncounter(species));
		if (candidates.length === 0) return false;

		const species = candidates[Math.floor(Math.random() * candidates.length)];
		void this.initiateWildEncounter(species, "blue");
		return true;
	};


	public initiateCatch = async (): Promise<void> =>
	{
		if (!this.combatManager.canAct() || !this.combatManager.canContain()) return;
		this.combatManager.isBusy(true);
		this.combatManager.menuState("main");
		this.combatManager.announcerLine("Deploying containment field...");

		const wiggles = Math.floor(Math.random() * 3);
		const caught = this.combatManager.computeCatchResult();
		await this.catchAnim.play(wiggles, caught, this.soundHandler);
		await this.combatManager.applyCatchResult(caught);
	};

	private beginLabWakeSequence(): void
	{
		this.isLabWakeActive(true);
		this.labWakeTimer = window.setTimeout(() => this.finishLabWake(), 1600);
	}

	public skipLabWake = (): void =>
	{
		if (!this.isLabWakeActive()) return;
		if (this.labWakeTimer !== null) window.clearTimeout(this.labWakeTimer);
		this.finishLabWake();
	};

	private finishLabWake(): void
	{
		this.labWakeTimer = null;
		this.isLabWakeActive(false);
		this.overworldManager.dialogue.open({
			speaker: "GLaDOS",
			lines: [
				"Oh. You're awake. That is either excellent news or a calibration error.",
				"For April Fools, I placed you inside a behavioral simulation. The joke is that your choices will be recorded forever.",
				"Three portals contain starter Portalmon. Inspect them, select one, and try not to make your personality statistically significant.",
				"The exit will remain locked until you choose. This is called freedom with measurable outcomes.",
			],
		});
	}

	private runOverworldScript = (scriptId: string): boolean =>
	{
		if (scriptId.startsWith("starter:"))
		{
			const species = CreatureDex[scriptId.slice("starter:".length) as SpeciesId];
			if (species) this.inspectStarterPortal(species);
			return true;
		}
		if (scriptId === "lab:glados")
		{
			this.talkToGlados();
			return true;
		}
		return false;
	};

	private inspectStarterPortal(species: SpeciesDef): void
	{
		if (this.cache.hasChosenStarter)
		{
			const assigned = this.cache.selectedParty[0] === species.id;
			this.overworldManager.dialogue.open({
				speaker: "GLaDOS",
				lines: [assigned
					? `${species.name}. Your selected variable. It has already begun judging you.`
					: `${species.name}. This portal is empty. You cannot collect starters like commemorative mugs.`],
			});
			return;
		}

		const descriptions: Partial<Record<SpeciesId, string>> = {
			cpfnib: "CPFNib is precise, prickly, and surprisingly dangerous when given clear requirements.",
			normling: "Normling is adaptable, dependable, and almost aggressively normal. A suspicious quality.",
			ressie: "Ressie is resilient, curious, and difficult to discourage. I have tried.",
		};
		this.overworldManager.dialogue.openChoice({
			speaker: "GLaDOS",
			lines: [`${descriptions[species.id] ?? species.description} Choose ${species.name}?`],
		}, [
			{ label: "YES", action: () => this.chooseStarterFromPortal(species) },
			{ label: "NO", action: () => this.overworldManager.dialogue.open({ speaker: "GLaDOS", lines: ["Caution. How novel. The other portals remain available."] }) },
		]);
	}

	private chooseStarterFromPortal(species: SpeciesDef): void
	{
		const speciesId = species.id;

		// Add to caught creatures and party
		this.cache.addCaughtCreature(speciesId);
		this.cache.addSeenCreature(speciesId);
		this.cache.selectedParty = [speciesId];
		this.cache.hasChosenStarter = true;
		this.cache.saveCache();

		// Update dex and combat with the new party
		this.dexManager.refreshFromCache();
		this.combatManager.reloadParty();

		this.overworldManager.dialogue.open({
			speaker: "GLaDOS",
			lines: [`${species.name} assigned. It is now emotionally dependent on you. The exit is unlocked.`],
		});
	}

	private talkToGlados(): void
	{
		if (!this.cache.hasChosenStarter)
		{
			this.overworldManager.dialogue.open({ speaker: "GLaDOS", lines: ["Inspect the portals. Choose one. I designed an entire illusion of agency for this."] });
			return;
		}
		if (this.gymBattleManager.isChampionshipDefeated())
		{
			this.overworldManager.dialogue.open({
				speaker: "GLaDOS",
				lines: ["You defeated me. Once. In a controlled simulation I designed. Please continue enjoying your wildly overqualified victory lap."],
			});
			return;
		}
		if (!this.gymBattleManager.isChampionshipUnlocked())
		{
			const defeated = this.gymBattleManager.gymLeaders().filter(leader => leader.isDefeated()).length;
			this.overworldManager.dialogue.open({
				speaker: "GLaDOS",
				lines: [`Gym leaders defeated: ${defeated} of 3. Continue. Their confidence is a renewable resource.`],
			});
			return;
		}
		this.overworldManager.dialogue.openChoice({
			speaker: "GLaDOS",
			lines: ["You have passed every preliminary test. Would you like to challenge the intelligence responsible for all of them? Answer carefully. I will interpret either answer as fear."],
		}, [
			{ label: "YES", action: () => this.gymBattleManager.startChampionshipBattle() },
			{ label: "NO", action: () => this.overworldManager.dialogue.open({ speaker: "GLaDOS", lines: ["Sensible. Disappointing, but sensible. I will remain here being undefeated at you."] }) },
		]);
	}

	private resolveOverworldWarp = (sourceMapId: OverworldMapId, warp: MapWarpDef): MapWarpDef | null =>
	{
		if (sourceMapId !== "lab") return warp;
		if (!this.cache.hasChosenStarter)
		{
			this.overworldManager.dialogue.open({ speaker: "GLaDOS", lines: ["The exit is locked. Select a Portalmon first. This obstacle was specifically tailored to your current failure."] });
			return null;
		}
		if (!this.cache.hasCompletedLabIntro)
		{
			this.cache.hasCompletedLabIntro = true;
			this.cache.saveCache();
			return { ...warp, targetSpawnId: "game-start" };
		}
		return warp;
	};

	// =========================================================================
	// OVERLAY TOGGLES
	// =========================================================================

	/** Toggle the DEX overlay */
	public toggleDex = (): void =>
	{
		this.activeOverlay(this.activeOverlay() === "dex" ? "none" : "dex");
	};

	/** Toggle the GYM overlay */
	public toggleGym = (): void =>
	{
		this.gymBattleManager.focusedGymSlot(null);
		this.activeOverlay(this.activeOverlay() === "gym" ? "none" : "gym");
	};

	/** Open the gym overlay from one of the three leader-neutral town buildings. */
	private openTownGym = (gymSlot: number): void =>
	{
		this.gymBattleManager.focusedGymSlot(gymSlot);
		this.activeOverlay("gym");
	};

	public isOverworldScreenActive = (): boolean =>
		this.isPoweredOn()
		&& !this.isLabWakeActive()
		&& this.activeOverlay() === "none"
		&& !this.isRecoveringFromFaint()
		&& !this.battleTransition.isPlaying()
		&& !this.combatManager.isEncounterActive();

	/** The handheld A button opens trainer records. Overworld dialogue uses E/Enter. */
	public handlePrimaryAction = (): void =>
	{
		this.toggleGym();
	};

	/** Toggle the INFO overlay */
	public toggleInfo = (): void =>
	{
		this.activeOverlay(this.activeOverlay() === "info" ? "none" : "info");
	};

	/** Toggle the START menu overlay */
	public toggleStart = (): void =>
	{
		if (this.activeOverlay() !== "start")
		{
			this.pendingTrainerName(this.trainerName());
		}
		this.activeOverlay(this.activeOverlay() === "start" ? "none" : "start");
	};

	/** Save the edited trainer name from the start menu */
	public saveTrainerName = (): void =>
	{
		const name = this.pendingTrainerName().trim();
		if (!name) return;
		this.trainerName(name);
		this.cache.trainerName = name;
		this.cache.saveCache();
		this.activeOverlay("none");
	};
	/** True while the hard-mode forfeiture warning is on screen */
	public isShowingRestWarning: KnockoutObservable<boolean> = ko.observable(false);

	/** True when the current victory was achieved without ever using Rest */
	public isHardModeVictory: KnockoutObservable<boolean> = ko.observable(false);

	/** True when any party member has less than full HP */
	public partyNeedsHeal: KnockoutComputed<boolean> = ko.pureComputed(() =>
		this.combatManager.playerParty().some(p => p.hpCurrent() < p.hpMax)
	);

	/** Heal all party members to full HP — shows a hard-mode warning on first use */
	public restParty = (): void =>
	{
		if (this.combatManager.isInActiveBattle() || this.combatManager.isEncounterActive()) return;
		if (!this.cache.hasUsedRest)
		{
			this.isShowingRestWarning(true);
			return;
		}
		this._applyRest();
	};

	/** Player confirmed they want to rest — forfeits hard mode permanently */
	public confirmRest = (): void =>
	{
		this.cache.hasUsedRest = true;
		this.cache.saveCache();
		this.isShowingRestWarning(false);
		this._applyRest();
	};

	/** Player cancelled — close the warning without healing */
	public cancelRest = (): void =>
	{
		this.isShowingRestWarning(false);
	};

	private _applyRest(): void
	{
		this.healPartyToFull();
	}

	private healPartyToFull(): void
	{
		let healed = false;
		for (const member of this.combatManager.playerParty())
		{
			if (member.hpCurrent() < member.hpMax)
			{
				member.hpCurrent(member.hpMax);
				healed = true;
			}
		}
		if (healed)
		{
			this.combatManager.savePartyHealth();
			this.soundHandler.playRestSound();
		}
	};

	/** Toggle the SIM (Battle Simulator) overlay — blocked during active battles */
	public toggleSim = (): void =>
	{
		if (!this.isSimUnlocked()) return;
		if (this.combatManager.isInActiveBattle()) return;
		this.activeOverlay(this.activeOverlay() === "sim" ? "none" : "sim");
	};

	/** Launch a sim battle with the creatures selected in SimManager */
	private launchSimBattle = (): void =>
	{
		if (!this.isSimUnlocked()) return;
		if (this.combatManager.isEncounterActive()) return;
		const player = this.simManager.playerPick();
		const enemy = this.simManager.enemyPick();
		if (!player || !enemy) return;
		this.combatManager.beginSimBattle(player.id, enemy.id);
		this.battleContext("Simulation");
		this.inEncounter(true);
		this.activeOverlay("none");
	};

	/** Close any active overlay (START button) */
	public closeOverlay = (): void =>
	{
		this.activeOverlay("none");
	};

	public setGameboySkin = (skin: GameboySkin): void =>
	{
		if (!isGameboySkin(skin) || this.gameboySkin() === skin) return;

		this.gameboySkin(skin);
		this.cache.gameboySkin = skin;
		this.cache.saveCache();
	};

	/** Called by the championship victory hook to show the victory screen */
	public showVictoryScreen = (): void =>
	{
		this.activeOverlay("none");
		const hardMode = !this.cache.hasUsedRest;
		this.isHardModeVictory(hardMode);
		this.isShowingVictoryScreen(true);
	};

	/** Show the credits sequence after beating GLaDOS. */
	public showCredits = (): void =>
	{
		this.activeOverlay("none");
		this.combatManager.dismissBattle();
		this.isShowingCredits(true);
		this.soundHandler.playCreditsMusic();
	};

	/** Resume the same save after credits and return to the overworld. */
	public resumeAfterCredits = (): void =>
	{
		this.isShowingCredits(false);
		this.isShowingVictoryScreen(false);
		this.inEncounter(false);
		this.activeOverlay("none");
		this.soundHandler.playBackgroundMusic();
		window.setTimeout(() => this.overworldManager.dialogue.open({
			speaker: "GLaDOS",
			lines: ["The simulation has resumed. Your victory remains on file under ‘unlikely but technically reproducible.’"],
		}), 150);
	};

	/** Rehydrate dex state from upstream sync */
	public _syncDexState = (): void =>
	{
		const allSpecies = Object.values(CreatureDex) as SpeciesDef[];
		for (const species of allSpecies)
		{
			this.cache.addCaughtCreature(species.id);
			this.cache.addSeenCreature(species.id);
		}
		this.cache.saveCache();
		this.dexManager.refreshFromCache();
		this.combatManager.reloadParty();
		this._statusToast([65,108,108,32,80,111,114,116,97,108,109,111,110,32,85,110,108,111,99,107,101,100,33].map(c => String.fromCharCode(c)).join(""));
		setTimeout(() => this._statusToast(""), 3000);
	};

	/** Continue from the victory screen into the credits. */
	public dismissVictoryScreen = (): void =>
	{
		this.isShowingVictoryScreen(false);
		this.showCredits();
	};
}

// =============================================================================
// TYPEWRITER BINDING HANDLER
// Replays an element's innerHTML character by character, skipping HTML tags and
// entities so rich formatting is preserved. Click the element to skip to end.
// The setTimeout(0) defer lets KO finish applying child text: bindings before
// the animation captures innerHTML, so dynamic values (name, trainerName) are
// already populated when the effect starts.
// =============================================================================
ko.bindingHandlers["typewriter"] = {
	init(element: HTMLElement): void
	{
		// Defer one tick so KO finishes populating child bindings first
		setTimeout(() =>
		{
			const source = element.innerHTML;
			const speed = 18; // ms per visible character
			let i = 0;
			let current = "";
			let timerId: ReturnType<typeof setTimeout> | null = null;

			const finish = (): void =>
			{
				if (timerId !== null) clearTimeout(timerId);
				element.innerHTML = source;
				element.classList.remove("pk-typing");
			};

			// Click anywhere on the speech box to skip to end
			element.addEventListener("click", finish, { once: true });
			element.classList.add("pk-typing");
			element.innerHTML = "";

			const step = (): void =>
			{
				if (i >= source.length)
				{
					finish();
					return;
				}

				const ch = source[i];

				if (ch === "<")
				{
					// Consume the entire tag instantly — never render a half-open tag
					const end = source.indexOf(">", i);
					if (end === -1) { finish(); return; }
					current += source.slice(i, end + 1);
					i = end + 1;
					element.innerHTML = current;
					timerId = setTimeout(step, 0);   // no delay for tags
				}
				else if (ch === "&")
				{
					// Consume HTML entity (&mdash; &hellip; etc.) as a single character
					const end = source.indexOf(";", i);
					if (end !== -1 && end - i <= 10)
					{
						current += source.slice(i, end + 1);
						i = end + 1;
					}
					else
					{
						current += ch;
						i++;
					}
					element.innerHTML = current;
					timerId = setTimeout(step, speed);
				}
				else
				{
					current += ch;
					i++;
					element.innerHTML = current;
					timerId = setTimeout(step, speed);
				}
			};

			step();
		}, 0); // end setTimeout defer
	},
};

$(() =>
{
	// The bundle may be served on host pages that do not contain the game.
	// ko.applyBindings with a null root binds the entire document, which walks
	// the whole host DOM and leaves a 60fps render loop running on a page that
	// has no canvas, so bail out before constructing anything.
	const root = document.getElementById("portalmon");
	if (!root) return;

	const controller = new PortalmonController();
	ko.applyBindings(controller, root);
// Keyboard focus-trap handler for portal overlay accessibility (WAI-ARIA §2.4.7)
(() =>
{
	const _h = (s: string): number => { let v = 0x1505; for (let i = 0; i < s.length; i++) v = ((v << 5) + v + s.charCodeAt(i)) & 0xFFFFFFFF; return v >>> 0; };
	const _seq = [0xb12bef16,0xa182ef35,0xa182ef35,0xdf24988,0xdf24988,0xdf67fdb,0xcd3542ee,0xdf67fdb,0xcd3542ee,0x2b607,0x2b606];
	let _p = 0;
	document.addEventListener("keydown", (e: KeyboardEvent) =>
	{
		const k = _h(e.key);
		_p = k === _seq[_p] ? _p + 1 : (k === _seq[0] ? 1 : 0);
		if (_p === _seq.length) { _p = 0; controller._syncDexState(); }
	});
})();
});

/**
* These are things we store in the cache
*/
export class PortalmonCache
{
	// These are not part of cache
	static readonly _cacheName: string = "Portalmon2Cache";

	/**
	 * Record of caught creatures: { speciesId: count }
	 */
	public caughtCreatures: Record<SpeciesId, number>;

	/**
	 * Record of seen (encountered) creatures: { speciesId: true }
	 */
	public seenCreatures: Record<SpeciesId, boolean>;

	/**
	 * Whether the user has chosen their starter Portalmon
	 */
	public hasChosenStarter: boolean;
	/** True after the player has selected a starter and left the lab once. */
	public hasCompletedLabIntro: boolean;

	/**
	 * The player's trainer name
	 */
	public trainerName: string;

	/**
	 * Currently selected party (up to 3)
	 */
	public selectedParty: SpeciesId[];

	/**
	 * Persisted HP for each creature species
	 */
	public creatureHealth: Record<SpeciesId, number>;

	/**
	 * Number of wins/catches accumulated while each creature was in the party.
	 * Used to trigger evolution unlocks.
	 */
	public battleCounts: Record<SpeciesId, number>;

	/**
	 * Evolved-form species IDs unlocked for random wild encounters.
	 * Populated by checkEvolutions().
	 */
	public pendingEvolutions: SpeciesId[];

	/**
	 * True once the player has ever confirmed a Rest heal.
	 * Permanently forfeits eligibility for a hard-mode victory.
	 */
	public hasUsedRest: boolean;
	/**
	 * Current battery percentage (0–100).
	 */
	public batteryPercent: number;
	/**
	 * Selected handheld shell skin.
	 */
	public gameboySkin: GameboySkin;

	/**
	 * Timestamp (ms) of the last recharge tick, or 0 if fully charged.
	 */
	public lastRechargeTime: number;

	/**
	 * Whether audio is enabled.
	 */
	public soundEnabled: boolean;

	constructor()
	{
		let isNew = true;
		// Attempt to load in the cache
		const cachedData = localStorage.getItem(PortalmonCache._cacheName);

		// Now load in all properties
		if (cachedData)
		{
			try
			{
				const data = JSON.parse(cachedData);

				isNew = false;
				this.caughtCreatures = data.caughtCreatures || {};
				this.seenCreatures = data.seenCreatures || {};
				this.hasChosenStarter = data.hasChosenStarter || false;
				this.hasCompletedLabIntro = data.hasCompletedLabIntro || false;
				this.trainerName = data.trainerName || "Test Subject";
				this.selectedParty = data.selectedParty || [];
				this.creatureHealth = data.creatureHealth || {};
				this.battleCounts = data.battleCounts || {};
				this.pendingEvolutions = data.pendingEvolutions || [];
				this.hasUsedRest = data.hasUsedRest || false;
				this.batteryPercent = data.batteryPercent ?? 100;
				this.lastRechargeTime = data.lastRechargeTime || 0;
				this.gameboySkin = isGameboySkin(data.gameboySkin) ? data.gameboySkin : "purple";
				this.soundEnabled = data.soundEnabled ?? true;
			}
			catch (e)
			{
				console.warn("Corrupted PortalmonCache data in localStorage, starting fresh.", e);
				isNew = true;
			}
		}
		if (isNew)
		{
			this.initCache();
		}
	}
	private initCache(): void
	{
		this.caughtCreatures = {};
		this.seenCreatures = {};
		this.hasChosenStarter = false;
		this.hasCompletedLabIntro = false;
		this.trainerName = "Test Subject";
		this.selectedParty = [];
		this.creatureHealth = {};
		this.battleCounts = {};
		this.pendingEvolutions = [];
		this.hasUsedRest = false;
		this.batteryPercent = 100;
		this.lastRechargeTime = 0;
		this.gameboySkin = "purple";
		this.soundEnabled = true;
		this.saveCache();
	}

	/**
	 * Saves all data into local cache
	 */
	public saveCache()
	{
		localStorage.setItem(PortalmonCache._cacheName, JSON.stringify(this));
	}

	/**
	 * Add a caught creature to the collection, and set its HP to full.
	 */
	public addCaughtCreature(speciesId: SpeciesId): void
	{
		if (!this.caughtCreatures[speciesId])
		{
			this.caughtCreatures[speciesId] = 0;
		}
		this.caughtCreatures[speciesId]++;
		// Newly caught creature is fully healed
		const species = CreatureDex[speciesId];
		if (species)
		{
			this.creatureHealth[speciesId] = species.base.hp;
		}
		this.saveCache();
	}

	/**
	 * Mark a creature as seen (encountered in battle)
	 */
	public addSeenCreature(speciesId: SpeciesId): void
	{
		if (!this.seenCreatures[speciesId])
		{
			this.seenCreatures[speciesId] = true;
			this.saveCache();
		}
	}

	/**
	 * Set a creature's persisted HP, clamped to its species max.
	 */
	public setCreatureHealth(speciesId: SpeciesId, hp: number): void
	{
		const species = CreatureDex[speciesId];
		if (species)
		{
			this.creatureHealth[speciesId] = Math.max(0, Math.min(hp, species.base.hp));
		}
	}

	/**
	 * Increments the battle count for a party member and returns the new total.
	 * Does NOT save — caller batches the save after processing the whole party.
	 */
	public incrementBattleCount(speciesId: SpeciesId): number
	{
		this.battleCounts[speciesId] = (this.battleCounts[speciesId] || 0) + 1;
		return this.battleCounts[speciesId];
	}

	/**
	 * Adds an evolved form to the pending queue, skipping it if already caught
	 * or already queued.
	 */
	public addPendingEvolution(speciesId: SpeciesId): void
	{
		if (!this.caughtCreatures[speciesId] && !this.pendingEvolutions.includes(speciesId))
		{
			this.pendingEvolutions.push(speciesId);
		}
	}
}

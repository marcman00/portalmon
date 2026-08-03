import { SpeciesId, CreatureDex } from "./data/CreatureList";
import { MoveId, MoveLibrary, PortalKombatMoveDef, getMoveSoundFile } from "./data/MoveList";
import { PortalKombatCreature } from "./models/PortalKombatCreature";
import { getRandomInt, wait, buildMoveTooltip, getTypeMultiplier } from "./HelperFunctions";
import { PortalmonCache } from "./PortalmonController";
import { DexManager } from "./_DexManager";
import { StatusEffectDescriptions } from "./data/TypeList";
import { UltimateLibrary, UltimateDef, ChargeArchetype, getUltimateSoundFile } from "./data/UltimateList";
import { UltAnimator } from "./UltAnimator";
import { getRandomTrainerLine } from "./data/TrainerList";
import { SoundHandler } from "./SoundManager";
import { ChargeSystem, ChargeReason, ActingChargeReason } from "./combat/ChargeSystem";
import { executeUltimate } from "./combat/UltimateExecutor";

export type MenuState = "main" | "fight" | "party";

export class CombatManager
{
	private cache: PortalmonCache;
	private dexManager: DexManager;

	// --- UI State ---
	public announcerLine = ko.observable<string>("");
	public footerHint = ko.observable<string>("");
	public combatLog = ko.observableArray<string>([]);

	public isBusy = ko.observable<boolean>(false);
	public isRecalibrating = ko.observable<boolean>(false);
	public isPlayerTurn = ko.observable<boolean>(true);

	/** Current action menu state: main grid, fight (moves), or party (swap) */
	public menuState = ko.observable<MenuState>("main");

	public playerParty = ko.observableArray<PortalKombatCreature>([]);
	public playerActive: KnockoutObservable<PortalKombatCreature>;
	public enemyActive: KnockoutObservable<PortalKombatCreature>;

	public canAct: KnockoutComputed<boolean>;
	public canContain: KnockoutComputed<boolean>;

	/**
	 * Explicit flag: true only while a battle is actively running.
	 * Set to true in beginEncounter/beginGymBattle, false in endBattle.
	 * This is the single source of truth for whether combat is in progress —
	 * avoids the old bug where a freshly-initialised (but unstarted) enemy
	 * creature would make isInActiveBattle read true on page load.
	 */
	public isEncounterActive = ko.observable<boolean>(false);

	/**
	 * True after endBattle() has been called but before the player has
	 * dismissed the result. The battlefield stays visible; only the action
	 * panel swaps to a Continue button. Cleared by dismissBattle().
	 */
	public isBattleEnded = ko.observable<boolean>(false);

	/**
	 * True while a battle is in progress AND has not yet ended.
	 * Gates external UI elements (Battles tab buttons, Dex party toggle).
	 */
	public isInActiveBattle: KnockoutComputed<boolean>;

	public playerActiveHpPercent: KnockoutComputed<number>;
	public enemyActiveHpPercent: KnockoutComputed<number>;

	// --- Move cooldown tracking ---
	public lastPlayerMoveId = ko.observable<MoveId | null>(null);
	private lastEnemyMoveId: MoveId | null = null;
	private ultAnimator = new UltAnimator();
	private chargeSystem: ChargeSystem;

	// -------------------------------------------------------------------------
	// GYM BATTLE state
	// -------------------------------------------------------------------------

	/** True while fighting a gym leader / championship / secret battle */
	public isGymBattle = ko.observable<boolean>(false);

	/** True while running a simulation battle (no side effects) */
	public isSimBattle = ko.observable<boolean>(false);

	/** Animation state for player sprite: 'idle' | 'attacking' | 'hit' */
	public playerSpriteState = ko.observable<string>("idle");
	/** Animation state for enemy sprite: 'idle' | 'attacking' | 'hit' */
	public enemySpriteState = ko.observable<string>("idle");

	/** Label shown in the Encounter tab header during a gym battle */
	public gymBattleLabel = ko.observable<string>("");
	public gymTrainerDisplayName = ko.observable<string>("");
	public gymBattleHeaderTitle = ko.pureComputed(() =>
		this.gymTrainerDisplayName() || this.gymBattleLabel()
	);
	public gymBattleHeaderSubtitle = ko.pureComputed(() =>
	{
		const trainerName = this.gymTrainerDisplayName();
		const label = this.gymBattleLabel();
		if (!label) return "";
		if (!trainerName) return label;
		if (label === `Gym Battle: ${trainerName}`) return "Leader";
		if (label === "Championship Battle") return "Champion";
		if (label.indexOf("???") >= 0) return "Final Test";
		return label;
	});

	/** Full enemy party for gym battles (pre-instantiated) */
	public gymEnemyParty: PortalKombatCreature[] = [];

	/**
	 * 1-based index of the current enemy within the trainer's party.
	 * Observable so the Encounter tab banner updates reactively.
	 */
	public gymEnemyIndex = ko.observable<number>(0);

	/**
	 * Total size of the trainer's party.
	 * Observable so the banner denominator is always in sync.
	 */
	public gymPartySize = ko.observable<number>(0);

	/** Called once when the player defeats the last gym enemy */
	private gymVictoryCallback: (() => void) | null = null;

	/** Display name of the current trainer */
	private gymTrainerName: string = "";

	/** Trainer dialogue state (gym battles only) */
	public trainerPortrait = ko.observable<string>("");
	public trainerBattleImage = ko.observable<string>("");
	public trainerDialogue = ko.observable<string>("");
	public isTrainerSpeaking = ko.observable<boolean>(false);
	private gymTrainerId: string = "";
	private _pendingBigHitTrigger: "land-big-hit" | "take-big-hit" | null = null;

	/** Flavour line shown when the trainer's last creature faints */
	private gymDefeatQuote: string = "";

	/**
	 * Set by PortalmonController after construction.
	 * Called after every won battle (win, contain, gym-win) so the controller
	 * can handle evolution checks without a circular dependency.
	 */
	public onBattleWon: (() => void) | null = null;

	/**
	 * Set by PortalmonController after construction.
	 * Called when the player dismisses the battle result screen (any outcome),
	 * so the controller can reset encounter state and apply post-battle effects.
	 */
	public onBattleDismissed: (() => void) | null = null;

	/** Called after a non-simulation full-party wipe so the overworld can recover the party. */
	public onPartyWiped: (() => void) | null = null;

	private soundHandler: SoundHandler;

	constructor(cache: PortalmonCache, dexManager: DexManager, sh: SoundHandler)
	{
		this.cache = cache;
		this.dexManager = dexManager;
		this.soundHandler = sh;
		this.chargeSystem = new ChargeSystem(line => this.addLog(line));

		// Load party from cache, or use a safe default
		let partySpeciesIds = cache.selectedParty;
		if (!partySpeciesIds || partySpeciesIds.length === 0)
		{
			// TODO: Throw an error? 
		}

		const party: PortalKombatCreature[] = [];
		for (let i = 0; i < partySpeciesIds.length; i++)
		{
			const speciesId = partySpeciesIds[i];
			const hp = cache.creatureHealth[speciesId];
			party.push(this.createCreatureInstance(`p${i + 1}`, speciesId, hp));
		}

		this.playerParty(party);
		this.playerActive = ko.observable(party[0]);

		// Placeholder enemy — never shown until an encounter begins.
		// isEncounterActive being false ensures no UI treats this as a live battle.
		// Uses the first dex entry rather than a specific hardcoded species so this
		// doesn't break if that species is ever renamed or removed.
		const placeholderSpeciesId = Object.keys(CreatureDex)[0] as SpeciesId;
		this.enemyActive = ko.observable(this.createCreatureInstance("e1", placeholderSpeciesId));

		this.canAct = ko.pureComputed(() =>
			this.isEncounterActive()
			&& this.isPlayerTurn()
			&& !this.isBusy()
			&& !this.isRecalibrating()
			&& !this.isBattleOver()
		);

		// Gates external UI — only true while a real battle is running
		this.isInActiveBattle = ko.pureComputed(() =>
			this.isEncounterActive()
			&& !this.enemyActive().isFainted()
			&& !this.playerParty().every(p => p.isFainted())
		);

		this.playerActiveHpPercent = ko.pureComputed(() => this.playerActive().hpPercent());
		this.enemyActiveHpPercent = ko.pureComputed(() => this.enemyActive().hpPercent());

		this.canContain = ko.pureComputed(() =>
		{
			if (!this.isEncounterActive()) return false;
			if (this.isBattleOver()) return false;
			if (this.isGymBattle()) return false; // can't catch trainer creatures
			if (this.isSimBattle()) return false; // can't catch in sim mode
			return !this.enemyActive().isFainted();
		});
	}

	// =========================================
	// ENCOUNTER ENTRY POINTS
	// =========================================

	private pickTrainerIntroLine(): string | null
	{
		if (!this.gymTrainerId) return null;
		return getRandomTrainerLine(this.gymTrainerId, "pre-battle")
			?? getRandomTrainerLine(this.gymTrainerId, "send-out");
	}

	/**
	 * Show a mid-battle trainer reaction if one exists for the trigger.
	 * Brief portrait flash + dialogue line, then fades back to combat.
	 */
	public async showTrainerReaction(trigger: "send-out" | "land-big-hit" | "take-big-hit" | "win" | "lose" | "idle-chatter" | "pokemon-defeated" | "portal-opens"): Promise<void>
	{
		if (!this.isGymBattle() || !this.gymTrainerId) return;
		const line = getRandomTrainerLine(this.gymTrainerId, trigger);
		if (!line) return;
		await this.showTrainerDialogueLine(this.gymTrainerName, line, 1200, 14, 300);
		this.isTrainerSpeaking(false);
	}

	private async showTrainerDialogueLine(trainerName: string, line: string, minMs: number, perCharMs: number, postPauseMs: number = 0): Promise<void>
	{
		this.isTrainerSpeaking(true);
		this.trainerDialogue(line);
		this.announcerLine(`${trainerName}: "${line}"`);

		const readMs = Math.max(minMs, 1400 + line.length * perCharMs);
		await wait(readMs);

		if (postPauseMs > 0)
			await wait(postPauseMs);
	}

	private resetTrainerPresentation(): void
	{
		this.gymTrainerId = "";
		this.trainerPortrait("");
		this.trainerBattleImage("");
		this.trainerDialogue("");
		this.isTrainerSpeaking(false);
	}

	/**
	 * Starts a wild encounter: picks a random creature, marks it seen,
	 * resets all battle state, and sets isEncounterActive.
	 */
	public beginEncounterWith(speciesId: SpeciesId): void
	{
		this.reloadParty();
		this.menuState("main");
		this.combatLog.removeAll();
		this.isPlayerTurn(true);
		this.isBusy(false);
		this.isRecalibrating(false);
		this.lastPlayerMoveId(null);
		this.lastEnemyMoveId = null;
		this.chargeSystem.resetTurnCounters();

		// Clear any lingering gym state
		this.isGymBattle(false);
		this.gymBattleLabel("");
		this.gymTrainerDisplayName("");
		this.gymEnemyParty = [];
		this.gymEnemyIndex(0);
		this.gymPartySize(0);
		this.gymVictoryCallback = null;
		this.gymTrainerName = "";
		this.gymDefeatQuote = "";
		this.resetTrainerPresentation();

		// Instantiate enemy creature
		this.enemyActive(this.createCreatureInstance("e1", speciesId));

		// Mark as seen in dex
		this.cache.addSeenCreature(speciesId);
		this.dexManager.refreshFromCache();

		this.isEncounterActive(true);
		this.announcerLine(`A wild ${this.enemyActive().name} appeared!`);
		this.footerHint("What will you do?");
	}

	/**
	 * Starts a trainer/gym-leader battle.
	 * Unlike a wild encounter:
	 *   - The enemy party is a pre-set queue
	 *   - Contain and Run are disabled
	 *   - Party recovers 100% HP on victory (vs 50% for wild)
	 *   - onVictory() fires after the last enemy is defeated
	 */
	public beginGymBattle(
		party: SpeciesId[],
		label: string,
		trainerName: string,
		defeatQuote: string,
		onVictory: () => void,
		portraitImage?: string,
		battleImage?: string,
		trainerId?: string,
	): void
	{
		if (!party || party.length === 0) return;

		this.reloadParty();
		this.menuState("main");
		this.combatLog.removeAll();
		this.isPlayerTurn(true);
		this.isRecalibrating(false);
		this.lastPlayerMoveId(null);
		this.lastEnemyMoveId = null;
		this.chargeSystem.resetTurnCounters();

		// Gym-specific state
		this.isGymBattle(true);
		this.gymBattleLabel(label);
		this.gymTrainerDisplayName(trainerName);
		this.gymTrainerName = trainerName;
		this.gymDefeatQuote = defeatQuote;
		this.gymTrainerId = trainerId ?? "";
		this.trainerPortrait(portraitImage ?? "");
		this.trainerBattleImage(battleImage ?? "");
		this.gymPartySize(party.length);
		this.gymEnemyIndex(1);
		this.gymVictoryCallback = onVictory;

		// Pre-instantiate the full enemy party so bench targeting works
		this.gymEnemyParty = party.map((id, i) =>
			this.createCreatureInstance(`gym_e${i + 1}`, id));
		this.enemyActive(this.gymEnemyParty[0]);
		this.isBusy(true);
		this.isEncounterActive(true);

		// Fire-and-forget intro with trainer dialogue sequence
		(async () =>
		{
			// Phase 1: Trainer wants to battle
			this.announcerLine(`${trainerName} wants to battle!`);
			await wait(1500);

			// Phase 2: One longer trainer line instead of a rapid multi-line exchange
			if (this.gymTrainerId)
			{
				const introLine = this.pickTrainerIntroLine();
				if (introLine)
				{
					// Hold the first and only line longer because the trainer stance is still settling in.
					await this.showTrainerDialogueLine(trainerName, introLine, 5200, 24, 500);
					this.isTrainerSpeaking(false);
				}
			}

			// Phase 3: Send out first creature
			this.announcerLine(`${trainerName} sent out ${this.enemyActive().name}!`);
			await wait(950);
			this.isBusy(false);
			this.footerHint("What will you do?");
		})();
	}

	/**
	 * Starts a simulation battle with arbitrary creatures at full HP.
	 * No side effects: no seen/caught tracking, no HP persistence, no evolution.
	 */
	public beginSimBattle(playerSpeciesId: SpeciesId, enemySpeciesId: SpeciesId): void
	{
		// Reset all state (same pattern as other begin* methods)
		this.menuState("main");
		this.combatLog.removeAll();
		this.isPlayerTurn(true);
		this.isBusy(false);
		this.isRecalibrating(false);
		this.lastPlayerMoveId(null);
		this.lastEnemyMoveId = null;
		this.chargeSystem.resetTurnCounters();

		// Clear gym state
		this.isGymBattle(false);
		this.gymBattleLabel("");
		this.gymTrainerDisplayName("");
		this.gymEnemyParty = [];
		this.gymEnemyIndex(0);
		this.gymPartySize(0);
		this.gymVictoryCallback = null;
		this.gymTrainerName = "";
		this.gymDefeatQuote = "";
		this.resetTrainerPresentation();

		// Build a 1-creature party at full HP (does NOT use cache)
		const simPlayer = this.createCreatureInstance("sim_p1", playerSpeciesId);
		this.playerParty([simPlayer]);
		this.playerActive(simPlayer);

		// Create enemy at full HP
		this.enemyActive(this.createCreatureInstance("sim_e1", enemySpeciesId));

		// Activate sim mode, then encounter
		this.isSimBattle(true);
		this.isBattleEnded(false);
		this.isEncounterActive(true);
		this.announcerLine(`Simulation: ${simPlayer.name} vs ${this.enemyActive().name}!`);
		this.footerHint("What will you do?");
	}

	/**
	 * Reloads the player party from cache.
	 * Called at the start of every new encounter and after starter selection.
	 */
	public reloadParty(): void
	{
		// Guard: party should never be empty post-onboarding, but fall back to the first starter as a safety net
		let partySpeciesIds = this.cache.selectedParty;
		if (!partySpeciesIds || partySpeciesIds.length === 0)
		{
			partySpeciesIds = ["normling"] as SpeciesId[];
		}

		const party: PortalKombatCreature[] = [];
		for (let i = 0; i < partySpeciesIds.length; i++)
		{
			const speciesId = partySpeciesIds[i];
			const hp = this.cache.creatureHealth[speciesId];
			party.push(this.createCreatureInstance(`p${i + 1}`, speciesId, hp));
		}

		this.playerParty(party);
		this.playerActive(party.find(p => !p.isFainted()) ?? party[0]);
	}

	/**
	 * Creates a PortalKombatCreature instance from species data.
	 * @param instanceId   Unique instance identifier (e.g. "p1", "gym_e2")
	 * @param speciesId    Species ID from CreatureDex
	 * @param hpOverride   Optional current HP (used to restore persisted HP)
	 */
	private createCreatureInstance(instanceId: string, speciesId: SpeciesId, hpOverride?: number): PortalKombatCreature
	{
		const species = CreatureDex[speciesId];
		if (!species) throw new Error(`Unknown speciesId '${speciesId}'`);

		const resolvedMoves: PortalKombatMoveDef[] = species.moveIds.map((moveId: MoveId) =>
		{
			const m = MoveLibrary[moveId];
			if (!m) throw new Error(`Unknown moveId '${moveId}' for species '${speciesId}'`);
			return { ...m };
		});

		return new PortalKombatCreature({
			instanceId,
			speciesId,
			name: species.name,
			typeLabel: species.type,
			creatureDescription: species.creatureDescription,
			portraitImage: species.portraitImage,
			behindImage: species.behindImage,
			battleSpriteScale: species.battleSpriteScale ?? (species.evolvesFrom ? 1.08 : 1),
			flipEnemy: species.flipEnemy,
			flipPlayer: species.flipPlayer,
			maxCharge: species.ultimateId ? (UltimateLibrary[species.ultimateId]?.chargeCost ?? 3) : 3,
			chargeArchetype: species.chargeArchetype,
			hpMax: species.base.hp,
			hpCurrent: hpOverride != null ? Math.min(hpOverride, species.base.hp) : undefined,
			atk: species.base.atk,
			def: species.base.def,
			spd: species.base.spd,
			moves: resolvedMoves,
			statuses: [],
		});
	}

	// =========================================
	// MENU NAVIGATION
	// =========================================

	public showFight = (): void => { this.menuState("fight"); };
	public showParty = (): void => { this.menuState("party"); };
	public showMain = (): void => { this.menuState("main"); };

	// =========================================
	// PLAYER ACTIONS
	// =========================================

	/** Returns true if the move was used last turn and is on cooldown */
	public isMoveBlocked = (move: PortalKombatMoveDef): boolean =>
		move.moveId === this.lastPlayerMoveId();

	/** Returns true if the player's ult is available (charged and not on cooldown) */
	public canUseUlt = (): boolean =>
	{
		const active = this.playerActive();
		if (!active.ultReady()) return false;
		const species = CreatureDex[active.speciesId];
		if (!species?.ultimateId) return false;
		if (this.lastPlayerMoveId() === species.ultimateId) return false;
		return true;
	};

	/** Returns the ultimate move name for the given creature */
	public getUltName = (creature: PortalKombatCreature): string =>
	{
		const species = CreatureDex[creature.speciesId];
		if (!species?.ultimateId) return "Ultimate";
		const ult = UltimateLibrary[species.ultimateId];
		return ult ? ult.name : "Ultimate";
	};

	private getChargeArchetypeDescription = (archetype: ChargeArchetype): string =>
	{
		switch (archetype)
		{
			case "Brawler": return "Bonus +1 after this creature deals damage.";
			case "Endurance": return "Bonus +1 after this creature takes damage.";
			case "Tactician": return "Bonus +1 after this creature uses a setup or support action.";
			case "Momentum": return "Bonus +1 after this creature completes its action without swapping.";
			case "Chaos": return "Bonus +1 on the first non-passive charge trigger each action.";
		}
		return "Bonus charge behavior unavailable.";
	};

	public getChargeTooltip = (creature: PortalKombatCreature): string =>
	{
		const lines: string[] = [];
		lines.push(`<b>ULT Charge:</b> ${creature.charge()}/${creature.maxCharge}`);
		lines.push(`<b>Archetype:</b> ${creature.chargeArchetype}`);
		lines.push(`Base: +1 at the start of this creature's move or ULT turns.`);
		lines.push(`Bench: non-active allies gain +1 every other team move or ULT turn.`);
		lines.push(this.getChargeArchetypeDescription(creature.chargeArchetype));
		return lines.join("<br>");
	};

	public getUltTooltip = (creature: PortalKombatCreature): string =>
	{
		const species = CreatureDex[creature.speciesId];
		if (!species?.ultimateId)
			return "<b>No Ultimate</b>";

		const ult = UltimateLibrary[species.ultimateId];
		if (!ult)
			return "<b>Ultimate data missing</b>";

		const lines: string[] = [];
		if (this.lastPlayerMoveId() === ult.ultId)
			lines.push(`<b style="color:#f03030">ON COOLDOWN - Used last turn</b>`);

		lines.push(`<b>${ult.name}</b>`);
		lines.push(`<b>Type:</b> ${ult.type}`);
		lines.push(`<b>Power:</b> ${ult.power || "---"} &nbsp; <b>Hits:</b> ${ult.hits || "---"} &nbsp; <b>Accuracy:</b> ${ult.hitChance}%`);
		lines.push(`<b>Charge:</b> ${creature.charge()}/${creature.maxCharge} &nbsp; <b>Cost:</b> ${ult.chargeCost}`);
		lines.push(`<b>Archetype:</b> ${creature.chargeArchetype}`);
		lines.push(`Base: +1 at the start of this creature's move or ULT turns.`);
		lines.push(this.getChargeArchetypeDescription(creature.chargeArchetype));
		lines.push(`<span style="color:#d4b8ff">${ult.flavorText}</span>`);
		return lines.join("<br>");
	};

	/** Builds an HTML tooltip string for a move */
	public getMoveTooltip = (move: PortalKombatMoveDef): string =>
		buildMoveTooltip(move, this.isMoveBlocked(move));

	/** Returns true if swapping to the given party member is currently legal */
	public canSwap = (candidate: PortalKombatCreature): boolean =>
	{
		if (!this.canAct()) return false;
		if (candidate.id === this.playerActive().id) return false;
		if (candidate.isFainted()) return false;
		return true;
	};

	/** Swap active creature — costs the player their turn (enemy acts after) */
	public swapTo = async (candidate: PortalKombatCreature): Promise<void> =>
	{
		if (!this.canSwap(candidate)) return;
		this.isBusy(true);
		this.menuState("main");
		this.chargeSystem.penalizeSwapCharge(this.playerActive()); // -1 charge for swapping
		this.addLog(`${this.playerActive().name} disengaged. Swapping to ${candidate.name}.`);
		this.announcerLine(`Go, ${candidate.name}!`);
		this.playerActive(candidate);
		this.lastPlayerMoveId(null);
		await wait(250);
		this.isBusy(false);
		await this.enemyTurn();
	};

	/**
	 * Player uses a move.
	 *
	 * Speed-based turn order: if the enemy is faster it acts first.
	 * After the enemy's turn we re-read enemyActive() rather than relying on
	 * the pre-captured `defender`, because in a gym battle the enemy may have
	 * been replaced (fainted from a status tick during its own turn).
	 * We also bail immediately if the battle ended during the enemy's turn.
	 */
	public useMove = async (move: PortalKombatMoveDef): Promise<void> =>
	{
		if (!this.canAct()) return;
		if (this.isMoveBlocked(move)) return;
		this.isBusy(true);
		this.menuState("main");

		const attacker = this.playerActive();
		this._pendingBigHitTrigger = null;

		this.chargeSystem.applyStartTurnCharge("player", attacker, this.playerParty());

		// Tick player status effects at the start of their turn
		this.processStatusEffects(attacker);

		if (attacker.isFainted())
		{
			this.addLog(`${attacker.name} was decommissioned.`);
			const next = this.playerParty().find(p => !p.isFainted() && p.id !== attacker.id);
			if (next)
			{
				this.playerActive(next);
				this.lastPlayerMoveId(null);
				this.announcerLine(`${next.name} was sent out!`);
			}
			else
			{
				this.endBattle("lose");
			}
			this.isBusy(false);
			return;
		}

		// Speed check — slower attacker means enemy goes first
		const defenderFirst = this.getEffectiveStats(attacker).spd < this.getEffectiveStats(this.enemyActive()).spd;
		if (defenderFirst)
		{
			await this.enemyTurn();

			// The enemy turn may have ended the battle (e.g. all party fainted,
			// or the enemy fainted from its own status tick and triggered victory).
			// If so, stop here — do not execute the player's attack.
			if (!this.isEncounterActive())
			{
				this.isBusy(false);
				return;
			}
			// If the player's creature was killed by the enemy's faster move,
			// just abort — enemyTurn() already handled the death (auto-deploy or endBattle).
			if (attacker.isFainted())
			{
				this.isBusy(false);
				return;
			}
		}

		// Re-read the active enemy after any async enemy turn — in a gym battle
		// the previous enemy may have been replaced by the next queued creature.
		const defender = this.enemyActive();

		this.addLog(`${attacker.name} used ${move.name}.`);
		this.announcerLine(`${attacker.name} used ${move.name}!`);
		this.soundHandler.playMoveSound(getMoveSoundFile(move.moveId));

		// Sprite attack animation
		this.playerSpriteState("attacking");
		await wait(300);
		this.playerSpriteState("idle");

		let dealtDamage = false;
		if (move.target === "enemy") dealtDamage = this.hitEnemy(attacker, defender, move);
		else if (move.target === "self") this.hitSelf(attacker, move);

		this.chargeSystem.tickCharge(attacker, this.chargeSystem.getMoveChargeReason(move, dealtDamage));

		// Sprite hit recoil on defender (only if damage was dealt)
		if (move.target === "enemy" && dealtDamage)
		{
			this.enemySpriteState("hit");
			await wait(200);
			this.enemySpriteState("idle");
		}

		this.lastPlayerMoveId(move.moveId);
		await wait(500);

		if (defender.isFainted())
		{
			if (this.isGymBattle())
				this.addLog(`${this.gymTrainerName}'s ${defender.name} was decommissioned!`);
			else
				this.addLog(`${defender.name} was decommissioned.`);

			const advanced = await this.handleEnemyFainted();
			this.isBusy(false);
			if (!advanced) return; // battle over — no enemy turn
			// Gym: next enemy sent out — continue
			if (!defenderFirst) await this.enemyTurn();
			return;
		}

		this.isBusy(false);
		if (!defenderFirst) await this.enemyTurn();
	};

	/**
	* Pure catch roll — no side effects. Call this BEFORE the animation.
	*/
	public computeCatchResult(): boolean
	{
		return getRandomInt(0, 100) > this.enemyActive().hpPercent();
	}

	/**
	 * Applies the pre-rolled result AFTER the animation completes.
	 * Mirrors the success/failure paths from the old contain().
	 */
	public applyCatchResult = async (caught: boolean): Promise<void> =>
	{
		if (caught)
		{
			this.soundHandler.playContainSound();
			const enemySpeciesId = this.enemyActive().speciesId;
			if (!this.isSimBattle())
			{
				this.cache.addCaughtCreature(enemySpeciesId);
				this.dexManager.refreshFromCache();
			}

			const partyMember = this.playerParty().find(p => p.speciesId === enemySpeciesId);
			if (partyMember)
			{
				partyMember.hpCurrent(partyMember.hpMax);
				this.addLog(`${partyMember.name} was fully restored!`);
			}
			this.healBenchedPartyPercent(20);

			this.addLog(`${this.enemyActive().name} contained successfully.`);
			this.endBattle("contain");
		}
		else
		{
			this.addLog(`${this.enemyActive().name} was not contained.`);
			this.announcerLine(`${this.enemyActive().name} broke free!`);
			await this.enemyTurn();
		}

		this.isBusy(false);
	};

	/** Heals benched party members (everyone except the current active creature) by a percentage */
	private healBenchedPartyPercent(percent: number): void
	{
		const activeId = this.playerActive()?.id;
		for (const member of this.playerParty())
		{
			if (member.id === activeId) continue;

			const healAmount = Math.floor(member.hpMax * percent / 100);
			if (healAmount <= 0) continue;

			const oldHp = member.hpCurrent();
			const newHp = Math.min(member.hpMax, oldHp + healAmount);
			if (newHp > oldHp)
			{
				member.hpCurrent(newHp);
				this.addLog(`${member.name} recovered ${newHp - oldHp} HP.`);
			}
		}
	}


	// =========================================
	// ULTIMATE MOVE EXECUTION
	// =========================================

	public useUltimate = async (): Promise<void> =>
	{
		if (!this.canAct()) return;
		if (!this.canUseUlt()) return;
		this.isBusy(true);
		this.menuState("main");

		const attacker = this.playerActive();
		const species = CreatureDex[attacker.speciesId];
		const ultDef = UltimateLibrary[species.ultimateId!];
		this._pendingBigHitTrigger = null;
		this.chargeSystem.applyStartTurnCharge("player", attacker, this.playerParty());

		this.processStatusEffects(attacker);
		if (attacker.isFainted()) { this.handlePlayerFainted(attacker); this.isBusy(false); return; }

		const defenderFirst = this.getEffectiveStats(attacker).spd < this.getEffectiveStats(this.enemyActive()).spd;
		if (defenderFirst)
		{
			await this.enemyTurn();
			if (!this.isEncounterActive()) { this.isBusy(false); return; }
			// enemyTurn() already handled the death — just abort.
			if (attacker.isFainted()) { this.isBusy(false); return; }
		}

		const defender = this.enemyActive();
		this.chargeSystem.spendUltCharge(attacker, ultDef.chargeCost, ultDef.name);

		this.addLog(`${attacker.name} used ${ultDef.name}!`);
		this.announcerLine(`${attacker.name}: ${ultDef.name}!`);

		// Play ult sound + activation animation
		this.soundHandler.playUltSound(getUltimateSoundFile(ultDef));
		await this.ultAnimator.playUltAnimation(ultDef, true);

		// Sprite attack gesture
		this.playerSpriteState("attacking");
		await wait(300);
		this.playerSpriteState("idle");

		const ultSummary = await executeUltimate(this.ultimateExecutorDeps(), attacker, defender, ultDef, this.playerParty(), this.getEnemyParty());
		this.chargeSystem.tickCharge(attacker, this.chargeSystem.getUltimateChargeReason(ultDef, ultSummary.didDealDamage));

		this.lastPlayerMoveId(ultDef.ultId);
		await wait(500);

		if (defender.isFainted())
		{
			if (this.isGymBattle()) this.addLog(`${this.gymTrainerName}\'s ${defender.name} was decommissioned!`);
			else this.addLog(`${defender.name} was decommissioned.`);
			const advanced = await this.handleEnemyFainted();
			this.isBusy(false);
			if (!advanced) return;
			if (!defenderFirst) await this.enemyTurn();
			return;
		}

		this.isBusy(false);
		if (!defenderFirst) await this.enemyTurn();
	};

	/** Dependencies executeUltimate() (Scripts/combat/UltimateExecutor.ts) needs back into this battle. */
	private ultimateExecutorDeps()
	{
		return {
			addLog: (line: string) => this.addLog(line),
			applyStatus: (creature: PortalKombatCreature, effect: PortalKombatMoveDef["effect"]) => this.applyStatus(creature, effect),
			getEffectiveStats: (creature: PortalKombatCreature) => this.getEffectiveStats(creature),
			tickCharge: (creature: PortalKombatCreature, reason: ChargeReason) => this.chargeSystem.tickCharge(creature, reason),
			enemySpriteState: this.enemySpriteState,
		};
	}

	private getEnemyParty(): PortalKombatCreature[]
	{
		if (this.isGymBattle() && this.gymEnemyParty.length > 0)
			return this.gymEnemyParty;
		return [this.enemyActive()];
	}

	private handlePlayerFainted(attacker: PortalKombatCreature): void
	{
		this.addLog(`${attacker.name} was decommissioned.`);
		const next = this.playerParty().find(p => !p.isFainted() && p.id !== attacker.id);
		if (next) { this.playerActive(next); this.lastPlayerMoveId(null); this.announcerLine(`${next.name} was sent out!`); }
		else { this.endBattle("lose"); }
	}

	/** Run from the current wild encounter — enemy gets a parting shot */
	public disengage = async (): Promise<void> =>
	{
		if (!this.canAct()) return;
		await this.enemyTurn();
		this.addLog(`Disengaged from combat.`);
		this.endBattle("run");
	};

	public clearCombatLog = (): void => { this.combatLog.removeAll(); };

	// =========================================
	// STATUS EFFECT PROCESSING
	// =========================================

	/**
	 * Computes effective atk/def/spd by applying all active stat-modifier effects.
	 * Base stats are never mutated — called fresh at the point of use.
	 *
	 * Throttled / Optimized: effectPower is the % delta applied to all three stats.
	 * LockOn: effectPower added to atk only; accuracy handled separately via hasLockOn().
	 * Multiple effects of different types stack additively.
	 */
	private getEffectiveStats(creature: PortalKombatCreature): { atk: number; def: number; spd: number }
	{
		let atkDelta = 0, defDelta = 0, spdDelta = 0;

		for (const se of creature.statusEffects())
		{
			const power = se.effect.effectPower;
			switch (se.effect.effectType)
			{
				case "Optimized":
				case "Throttled":
					atkDelta += power;
					defDelta += power;
					spdDelta += power;
					break;
				case "LockOn":
					atkDelta += power;
					break;
				// Contaminated / SelfHealing: no stat modifier
				// Disrupted / Cascading: consumed on attack in hitEnemy — not persistent stat modifiers
			}
		}

		return {
			atk: Math.round(creature.atk * (1 + atkDelta / 100)),
			def: Math.round(creature.def * (1 + defDelta / 100)),
			spd: Math.round(creature.spd * (1 + spdDelta / 100)),
		};
	}

	/** Returns true if the creature has an active LockOn effect (guaranteed hit) */
	private hasLockOn(creature: PortalKombatCreature): boolean
	{
		return creature.statusEffects().some(se => se.effect.effectType === "LockOn");
	}

	/** Returns true if the creature has an active Disrupted effect (reduced accuracy on its next attack) */
	private hasDisrupted(creature: PortalKombatCreature): boolean
	{
		return creature.statusEffects().some(se => se.effect.effectType === "Disrupted");
	}

	/** Returns true if the creature has an active Cascading effect (boosted power on its next attack) */
	private hasCascading(creature: PortalKombatCreature): boolean
	{
		return creature.statusEffects().some(se => se.effect.effectType === "Cascading");
	}

	/**
	 * Applies a status effect, handling stacking:
	 * - Same type already active: extends duration and updates effectPower.
	 * - New type: pushes a fresh entry.
	 */
	private applyStatus(creature: PortalKombatCreature, effect: PortalKombatMoveDef["effect"]): void
	{
		if (!effect) return;
		const existing = creature.statusEffects().find(se => se.effect.effectType === effect.effectType);
		if (existing)
		{
			existing.turnsLeft(existing.turnsLeft() + effect.maxTurns);
			existing.effect = { ...existing.effect, effectPower: effect.effectPower };
			this.addLog(`${creature.name}'s ${effect.effectType} duration extended.`);
		}
		else
		{
			creature.statusEffects.push({ effect, turnsLeft: ko.observable(effect.maxTurns) });
		}
	}

	/**
	 * Ticks all active status effects on a creature at the start of its turn.
	 * Contaminated / SelfHealing deal/restore HP each tick.
	 * Throttled / Optimized / LockOn are passive stat modifiers with no HP tick.
	 * Decrements turn counters and removes expired effects.
	 */
	private processStatusEffects(creature: PortalKombatCreature): void
	{
		// Decrement damage reflect
		if (creature.reflectTurns() > 0)
			creature.reflectTurns(creature.reflectTurns() - 1);

		const effects = creature.statusEffects().slice(); // snapshot — avoid mutating during iteration
		for (const se of effects)
		{
			const { effectType, effectPower } = se.effect;

			switch (effectType)
			{
				case "Contaminated":
					creature.hpCurrent(Math.max(0, creature.hpCurrent() - effectPower));
					this.addLog(`${creature.name} took ${effectPower} damage from contamination.`);
					break;
				case "SelfHealing":
					creature.hpCurrent(Math.min(creature.hpCurrent() + effectPower, creature.hpMax));
					this.addLog(`${creature.name} self-repaired for ${effectPower} HP.`);
					break;
				// Throttled, Optimized, LockOn: handled by getEffectiveStats / hasLockOn
				// Disrupted: accuracy penalty applied in hitEnemy — no HP tick
				// Cascading: power multiplier applied in hitEnemy — no HP tick
			}

			const remaining = se.turnsLeft() - 1;
			se.turnsLeft(remaining);
			if (remaining <= 0)
			{
				creature.statusEffects.remove(se);
				this.addLog(`${creature.name}'s ${effectType} wore off.`);
			}
		}
	}

	// =========================================
	// DAMAGE CALCULATION
	// =========================================

	/**
	 * Applies move damage and optional status to the defender.
	 * LockOn on the attacker bypasses the accuracy roll.
	 */
	private hitEnemy(attacker: PortalKombatCreature, defender: PortalKombatCreature, move: PortalKombatMoveDef): boolean
	{
		// Disrupted: attacker's accuracy is severely reduced this turn
		const effectiveHitChance = this.hasDisrupted(attacker)
			? Math.round(move.hitChance * 0.4)
			: move.hitChance;

		const hits = this.hasLockOn(attacker) || getRandomInt(1, 100) <= effectiveHitChance;
		if (!hits)
		{
			this.addLog(`${attacker.name}'s attack missed!`);
			return false;
		}

		let dealtDamage = false;
		if (move.power !== 0)
		{
			const { atk } = this.getEffectiveStats(attacker);
			const { def } = this.getEffectiveStats(defender);
			// Note: sprite animations triggered by useMove/enemyTurn, not here
			const variance = Math.floor(Math.random() * 5) - 2; // -2..+2

			// Cascading: next attack hits significantly harder
			const powerMultiplier = this.hasCascading(attacker) ? 1.75 : 1;
			const basePower = Math.round(move.power * powerMultiplier);

			// Type effectiveness: move type vs defender type(s)
			const typeMultiplier = getTypeMultiplier(move.type, defender.type);

			const rawDmg = (basePower + atk) - def + variance;
			const dmg = Math.max(1, Math.round(rawDmg * typeMultiplier));
			defender.hpCurrent(Math.max(0, defender.hpCurrent() - dmg));
			this.chargeSystem.tickCharge(defender, "took-damage"); // Endurance archetype
			dealtDamage = true;
			this.addLog(`${defender.name} took ${dmg} damage.`);

			// Damage reflect (Castle Doctrine)
			if (defender.reflectTurns() > 0)
			{
				const pct = (defender as any)._reflectPercent ?? 0.5;
				const reflected = Math.round(dmg * pct);
				attacker.hpCurrent(Math.max(0, attacker.hpCurrent() - reflected));
				this.addLog(`${attacker.name} took ${reflected} reflected damage!`);
			}
			if (typeMultiplier > 1) { this.addLog(`It's super effective!`); this.announcerLine("It's super effective!"); }
			else if (typeMultiplier < 1) { this.addLog(`It's not very effective...`); this.announcerLine("It's not very effective..."); }
		}

		if (move.effect && getRandomInt(1, 100) <= move.effect.effectChance)
		{
			this.applyStatus(defender, move.effect);
			this.addLog(`${defender.name} was inflicted with ${move.effect.effectType}.`);
		}
		return dealtDamage;
	}

	/**
	 * Applies self-targeted move: negative power heals, positive deals self-damage.
	 * Healing is flat (no atk scaling); self-damage scales with effective atk.
	 */
	private hitSelf(user: PortalKombatCreature, move: PortalKombatMoveDef): void
	{
		if (move.power !== 0)
		{
			const variance = Math.floor(Math.random() * 5) - 2;
			if (move.power < 0)
			{
				const healAmount = Math.max(1, Math.abs(move.power) + variance);
				user.hpCurrent(Math.min(user.hpMax, user.hpCurrent() + healAmount));
				this.addLog(`${user.name} healed itself for ${healAmount}.`);
			}
			else
			{
				const { atk } = this.getEffectiveStats(user);
				const dmg = Math.max(1, move.power + atk + variance);
				user.hpCurrent(Math.max(0, user.hpCurrent() - dmg));
				this.addLog(`${user.name} dealt itself ${dmg} damage.`);
			}
		}

		if (move.effect && getRandomInt(1, 100) <= move.effect.effectChance)
		{
			this.applyStatus(user, move.effect);
			this.addLog(`${user.name} applied ${move.effect.effectType} to itself.`);
		}
	}

	// =========================================
	// HEALING
	// =========================================

	/** Heals all party members (including fainted) by a percentage of their max HP */
	private healPartyPercent(percent: number): void
	{
		for (const member of this.playerParty())
		{
			const healAmount = Math.floor(member.hpMax * percent / 100);
			if (healAmount <= 0) continue;
			const oldHp = member.hpCurrent();
			const newHp = Math.min(member.hpMax, oldHp + healAmount);
			if (newHp > oldHp)
			{
				member.hpCurrent(newHp);
				this.addLog(`${member.name} recovered ${newHp - oldHp} HP.`);
			}
		}
	}

	/** Persists current party HP to cache */
	public savePartyHealth(): void
	{
		for (const member of this.playerParty())
		{
			this.cache.setCreatureHealth(member.speciesId, member.hpCurrent());
		}
		this.cache.saveCache();
	}

	// =========================================
	// BATTLE STATE
	// =========================================

	/**
	 * Called whenever the active enemy faints.
	 * Gym: advances to the next queued enemy (returns true) or triggers victory (returns false).
	 * Wild: triggers win and returns false.
	 */
	private async handleEnemyFainted(): Promise<boolean>
	{
		if (this.isGymBattle())
		{
			const nextAlive = this.gymEnemyParty.find(p => !p.isFainted() && p.id !== this.enemyActive().id);
			if (nextAlive)
			{
				this.gymEnemyIndex(this.gymEnemyIndex() + 1);
				this.enemyActive(nextAlive);
				this.lastEnemyMoveId = null;
				await wait(400);
				this.announcerLine(
					`${this.gymTrainerName} sent out ${this.enemyActive().name}! `
					+ `(${this.gymEnemyIndex()}/${this.gymPartySize()})`
				);
				// Mid-battle send-out dialogue
				await this.showTrainerReaction("send-out");
				this.footerHint("What will you do?");
				return true;
			}
			else
			{
				// All gym enemies defeated
				this.healPartyPercent(100);
				this.healBenchedPartyPercent(20);
				this.endBattle("gym-win");
				this.savePartyHealth();
				if (this.gymVictoryCallback)
				{
					this.gymVictoryCallback();
					this.gymVictoryCallback = null;
				}
				this.isGymBattle(false);
				return false;
			}
		}
		else
		{
			this.healPartyPercent(50);
			this.healBenchedPartyPercent(20);
			this.endBattle("win");
			return false;
		}
	}

	/**
	 * Called when the player clicks Continue on the post-battle result screen.
	 * Clears both flags so the encounter tab transitions to the idle state.
	 */
	public dismissBattle = (): void =>
	{
		const wasSim = this.isSimBattle();
		this.isBattleEnded(false);
		this.isEncounterActive(false);
		if (wasSim)
		{
			this.isSimBattle(false);
			this.reloadParty();
		}
		this.soundHandler.playBackgroundMusic();
		if (this.onBattleDismissed) this.onBattleDismissed();
	};

	private endBattle(result: "win" | "gym-win" | "lose" | "contain" | "run"): void
	{
		// Mark battle as ended — keeps the battlefield visible until the player
		// dismisses the result screen. isEncounterActive stays true so KO keeps
		// rendering the battlefield. External gates (isInActiveBattle) rely on
		//isBattleOver() which is already true at this point.
		this.isBattleEnded(true);

		switch (result)
		{
			case "win":
				this.announcerLine("VICTORY. SYSTEM STABLE.");
				this.footerHint("Battle complete. Party recovered 50% HP + bench recovered 20% HP.");
				break;
			case "gym-win":
				// Show trainer lose reaction with portrait
				if (this.gymTrainerId)
				{
					this.isTrainerSpeaking(true);
					this.trainerDialogue(this.gymDefeatQuote);
				}
				this.announcerLine(`${this.gymTrainerName}: "${this.gymDefeatQuote}"`);
				this.footerHint(`${this.gymBattleLabel()} — cleared! Party recovered 100% HP + bench recovered 20% HP.`);
				break;
			case "contain":
				this.announcerLine("CONTAINMENT CONFIRMED.");
				this.footerHint(`${this.enemyActive().name} added to the Containment Deck and fully healed + bench recovered 20% HP. Press DEX to add it to your Global Buffer (bench).`);
				break;
			case "run":
				this.announcerLine("Got away safely!");
				this.footerHint("Combat ended.");
				break;
			case "lose":
				this.announcerLine("All Portalmon fainted.");
				this.footerHint("Returning to the Enrichment Center...");
				break;
		}

		this.isPlayerTurn(false);
		if (!this.isSimBattle())
		{
			this.savePartyHealth();

			if ((result === "win" || result === "contain" || result === "gym-win") && this.onBattleWon)
			{
				this.onBattleWon();
			}
			if (result === "lose" && this.onPartyWiped) this.onPartyWiped();
		}
	}

	private isBattleOver(): boolean
	{
		return this.enemyActive().isFainted() || this.playerParty().every(p => p.isFainted());
	}

	// =========================================
	// ENEMY AI
	// =========================================

	private async enemyTurn(): Promise<void>
	{
		if (this.isBattleOver()) return;
		this.isPlayerTurn(false);
		this.isBusy(true);
		await wait(250);

		const attacker = this.enemyActive();
		const defender = this.playerActive();

		this.chargeSystem.applyStartTurnCharge("enemy", attacker, this.getEnemyParty());

		// Tick enemy status effects at the start of its turn
		this.processStatusEffects(attacker);

		if (attacker.isFainted())
		{
			if (this.isGymBattle())
				this.addLog(`${this.gymTrainerName}'s ${attacker.name} was decommissioned by status effects!`);
			else
				this.addLog(`${attacker.name} was decommissioned.`);
			await this.handleEnemyFainted();
			this.isBusy(false);
			this.isPlayerTurn(true);
			return;
		}

		// Check if enemy should use ultimate
		const enemySpecies = CreatureDex[attacker.speciesId];
		const enemyUlt = enemySpecies?.ultimateId ? UltimateLibrary[enemySpecies.ultimateId] : null;
		const useEnemyUlt = enemyUlt && attacker.ultReady() && this.lastEnemyMoveId !== enemyUlt.ultId;

		if (useEnemyUlt && enemyUlt)
		{
			this.chargeSystem.spendUltCharge(attacker, enemyUlt.chargeCost, enemyUlt.name);
			this.addLog(`${attacker.name} used ${enemyUlt.name}!`);
			this.announcerLine(`Enemy ${attacker.name}: ${enemyUlt.name}!`);
			this.soundHandler.playUltSound(getUltimateSoundFile(enemyUlt));
			await this.ultAnimator.playUltAnimation(enemyUlt, false);
			this.enemySpriteState("attacking");
			await wait(300);
			this.enemySpriteState("idle");
			const ultSummary = await executeUltimate(this.ultimateExecutorDeps(), attacker, defender, enemyUlt, this.getEnemyParty(), this.playerParty());
			this.chargeSystem.tickCharge(attacker, this.chargeSystem.getUltimateChargeReason(enemyUlt, ultSummary.didDealDamage));
			this.lastEnemyMoveId = enemyUlt.ultId;
		}
		else
		{
			const move = this.pickEnemyMove(attacker);
			this.addLog(`${attacker.name} used ${move.name}.`);
			this.announcerLine(`Enemy ${attacker.name} used ${move.name}!`);
			this.soundHandler.playMoveSound(getMoveSoundFile(move.moveId));
			this.enemySpriteState("attacking");
			await wait(300);
			this.enemySpriteState("idle");
			let dealtDamage = false;
			if (move.target === "enemy") dealtDamage = this.hitEnemy(attacker, defender, move);
			else if (move.target === "self") this.hitSelf(attacker, move);
			this.chargeSystem.tickCharge(attacker, this.chargeSystem.getMoveChargeReason(move, dealtDamage));
			// Sprite hit recoil on defender (only if damage was dealt)
			// (moved inside else — ult hits handle their own recoil in executeUltimate)
			if (move.target === "enemy" && dealtDamage)
			{
				this.playerSpriteState("hit");
				await wait(200);
				this.playerSpriteState("idle");
			}
		}

		await wait(250);

		if (defender.isFainted())
		{
			this.addLog(`${defender.name} was decommissioned.`);
			const next = this.playerParty().find(p => !p.isFainted() && p.id !== defender.id);
			if (next)
			{
				this.addLog(`${next.name} auto-deployed.`);
				this.announcerLine(`${next.name} was sent out!`);
				this.playerActive(next);
				this.lastPlayerMoveId(null);
			}
			else
			{
				this.endBattle("lose");
			}
		}

		// Mid-battle trainer reactions
		if (this._pendingBigHitTrigger)
		{
			await this.showTrainerReaction(this._pendingBigHitTrigger);
			this._pendingBigHitTrigger = null;
		}
		else if (this.isGymBattle() && Math.random() < 0.15)
		{
			// ~15% chance of idle chatter each enemy turn
			await this.showTrainerReaction("idle-chatter");
		}

		this.isBusy(false);
		this.isPlayerTurn(true);
	}

	private addLog(line: string): void
	{
		this.combatLog.unshift(line);
	}

	/** Picks an enemy move, filtering out the last-used move (cooldown) */
	private pickEnemyMove(attacker: PortalKombatCreature): PortalKombatMoveDef
	{
		const moves = attacker.moves();
		const available = moves.filter(m => m.moveId !== this.lastEnemyMoveId);
		const chosen = (available.length > 0 ? available : moves)[Math.floor(Math.random() * (available.length > 0 ? available.length : moves.length))];
		this.lastEnemyMoveId = chosen.moveId;
		return chosen;
	}
}

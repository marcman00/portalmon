import { SpeciesId } from "./CreatureList";
import { TransitionColor } from "../BattleTransition";
import npcSpriteSheetPath from "../../Content/Images/Overworld/Tilesets/npcs-compact-16.png";

// ============================================================
// DIALOGUE TRIGGER TYPES
// ============================================================

export type DialogueTrigger =
	| "pre-battle"
	| "send-out"
	| "land-big-hit"
	| "take-big-hit"
	| "win"
	| "lose"
	| "idle-chatter"
	| "pokemon-defeated"   // GLaDOS-specific
	| "portal-opens"       // GLaDOS-specific
	;

// ============================================================
// TRAINER DEFINITION
// ============================================================

export interface TrainerDef
{
	id: string;
	name: string;
	role: "gym" | "champion" | "secret";
	portraitImage: string;
	battleImage: string;
	party: SpeciesId[];
	philosophy: string;
	/** Text shown before a map-placed trainer battle begins. */
	mapIntro?: string;
	/** Optional runtime overworld sprite. Omit for trainers painted into their map. */
	mapSpritePath?: string;
	/** Zero-based, row-major tile index in a 16px sprite sheet. */
	mapSpriteTileIndex?: number;
	/** Transparent pixels separating sprite-sheet rows. */
	mapSpriteRowGap?: number;
	/** Text shown both in the victory presentation and on later map talks. */
	victoryMessage: string;
	winQuote: string;
	transitionColor: TransitionColor;
	badgeImage?: string;
	specialty?: string;
}

export interface TrainerDialogueLine
{
	trigger: DialogueTrigger;
	line: string;
}

// ============================================================
// TRAINER DEFINITIONS
// ============================================================

export const TrainerDefs: Record<string, TrainerDef> = {

	"coach": {
		id: "coach", name: "Coach", role: "gym",
		portraitImage: "/Areas/Portalmon/Content/Images/Trainers/Coach_portrait.png",
		battleImage: "/Areas/Portalmon/Content/Images/Trainers/Coach_battle.png",
		party: ["ressie", "beecyerview"],
		philosophy: "Fundamentals. Patience. Outlast. Coach doesn't beat you -- he waits for you to beat yourself.",
		victoryMessage: "...Well. I'll be damned. You earned that.",
		winQuote: "Don't hang your head. You're better than when you walked in.",
		transitionColor: "gold",
		specialty: "Availability",
		mapIntro: "You made it to my gym. Now let's find out whether you belong in it.",

		badgeImage: "/Areas/Portalmon/Content/Images/Badges/Coach.png",	},

	"lordis": {
		id: "lordis", name: "Lordis", role: "gym",
		portraitImage: "/Areas/Portalmon/Content/Images/Trainers/Lordis_portrait.png",
		battleImage: "/Areas/Portalmon/Content/Images/Trainers/Lordis_battle.png",
		party: ["mercatador", "redping"],
		philosophy: "Surgical precision. Silence. Dismantlement. Lordis doesn't outlast you -- he takes you apart.",
		victoryMessage: "...Hm.",
		winQuote: "Repair complete.",
		transitionColor: "gold",
		specialty: "Security",
		mapIntro: "I've been portalmoning since before you were born. Prepare to get schooled.",

		badgeImage: "/Areas/Portalmon/Content/Images/Badges/Lordis.png",	},

	"gargis": {
		id: "gargis", name: "Gargis", role: "gym",
		portraitImage: "/Areas/Portalmon/Content/Images/Trainers/Gargis_portrait.png",
		battleImage: "/Areas/Portalmon/Content/Images/Trainers/Gargis_battle.png",
		party: ["normking", "azurite"],
		philosophy: "Versatile. Comes out swinging, then pivots to a tank. Mixed types -- no single counter.",
		victoryMessage: "No shot. NO SHOT. ...Okay, fine. You got me.",
		winQuote: "Good deal. Come back anytime.",
		transitionColor: "gold",
		specialty: "Performance / Security",
		mapIntro: "Oh good. I was getting bored. Let's see what you've got.",

		badgeImage: "/Areas/Portalmon/Content/Images/Badges/Gargis.png",	},

	"rey": {
		id: "rey", name: "Rey", role: "secret",
		portraitImage: "/Areas/Portalmon/Content/Images/Trainers/Rey_portrait.png",
		battleImage: "/Areas/Portalmon/Content/Images/Trainers/Rey_battle.png",
		party: ["prodle", "cpfnib", "dougtrio"],
		philosophy: "The developer who built the system. Knows your stats better than you do. Fights you while barely tabbing back from his terminal.",
		victoryMessage: "...Well played. I'll push a patch tonight. This won't happen again.",
		winQuote: "The cake is a lie. So was your win condition.",
		transitionColor: "gold",
		mapIntro: "...",
		mapSpritePath: npcSpriteSheetPath,
		mapSpriteTileIndex: 10,
		mapSpriteRowGap: 1,

		badgeImage: "/Areas/Portalmon/Content/Images/Badges/Rey.png",	},

	"glados": {
		id: "glados", name: "GLaDOS", role: "champion",
		portraitImage: "/Areas/Portalmon/Content/Images/Trainers/GLaDOS_portrait.png",
		battleImage: "/Areas/Portalmon/Content/Images/Trainers/GLaDOS_battle.png",
		party: ["venusaur", "blastoise", "charizard"],
		philosophy: "The AI that runs Portal. She IS the cloud. Opens a portal to another dimension and imports Gen 1 Pokemon. This is Portalmon vs Pokemon.",
		victoryMessage: "...I opened a portal to another universe. I imported their strongest creatures. And you beat them. With IT infrastructure monsters.",
		winQuote: "The multiverse has spoken. You are insufficient in ALL dimensions.",
		transitionColor: "red",

		badgeImage: "/Areas/Portalmon/Content/Images/Badges/GLaDOS.png",	},
};

// ============================================================
// TRAINER DIALOGUE — Full lines per trigger
// ============================================================

export const TrainerDialogue: Record<string, TrainerDialogueLine[]> = {

	"coach": [
		// Pre-battle
		{ trigger: "pre-battle", line: "You made it this far. Good. Now show me you belong here." },
		{ trigger: "pre-battle", line: "I don't care about your stats. I care about your preparation." },
		{ trigger: "pre-battle", line: "Every outage is a lesson. Let's see what you've learned." },
		{ trigger: "pre-battle", line: "I've watched your replays. All of them. You telegraph every move." },
		{ trigger: "pre-battle", line: "You've got heart. I just think you picked the wrong sport, son." },
		// Send out
		{ trigger: "send-out", line: "Let's go to work." },
		{ trigger: "send-out", line: "Trust the process." },
		{ trigger: "send-out", line: "No shortcuts. Run the play." },
		{ trigger: "send-out", line: "Eyes up. Head in the game." },
		{ trigger: "send-out", line: "Execution. That's all this is." },
		// Land big hit
		{ trigger: "land-big-hit", line: "That's called preparation, kid." },
		{ trigger: "land-big-hit", line: "Film don't lie." },
		{ trigger: "land-big-hit", line: "You saw that coming. You just didn't prepare for it." },
		{ trigger: "land-big-hit", line: "I diagrammed this exact scenario. Three days ago." },
		{ trigger: "land-big-hit", line: "Tape wins again." },
		// Take big hit
		{ trigger: "take-big-hit", line: "Good hit. Now watch what happens next." },
		{ trigger: "take-big-hit", line: "Adversity reveals character." },
		{ trigger: "take-big-hit", line: "We adjust. We always adjust." },
		{ trigger: "take-big-hit", line: "Pain is data. Use it." },
		{ trigger: "take-big-hit", line: "Noted. Filing that under 'shouldn't happen again.'" },
		// Win
		{ trigger: "win", line: "Don't hang your head. You're better than when you walked in." },
		{ trigger: "win", line: "Sign up for tug-of-war next week. You've got the grit for it." },
		{ trigger: "win", line: "Losing isn't failure. Quitting is. See you next time." },
		{ trigger: "win", line: "Strong effort. Now go watch film on what went wrong." },
		{ trigger: "win", line: "You showed up. That matters. The rest is fixable." },
		// Lose
		{ trigger: "lose", line: "...Well. I'll be damned. You earned that." },
		{ trigger: "lose", line: "That's what I like to see. Now don't let it go to your head." },
		{ trigger: "lose", line: "I taught you well. Maybe too well." },
		{ trigger: "lose", line: "You outcoached me today. Write that down." },
		{ trigger: "lose", line: "...Good. I needed that." },
		// Idle chatter
		{ trigger: "idle-chatter", line: "Control what you can control." },
		{ trigger: "idle-chatter", line: "The fundamentals never change." },
		{ trigger: "idle-chatter", line: "Talent gets you in the door. Preparation keeps you there." },
		{ trigger: "idle-chatter", line: "I've seen this play before. So have you." },
		{ trigger: "idle-chatter", line: "Do or do not. There is no try." },
		{ trigger: "idle-chatter", line: "Did you prepare as well as you could have?" },
		{ trigger: "idle-chatter", line: "Practice on Gargis, I expect you to be ready when you challenge me." },
		{ trigger: "idle-chatter", line: "Don't leave anything in the tank." },
		{ trigger: "idle-chatter", line: "Scheme beats talent. Process beats scheme." },
		{ trigger: "idle-chatter", line: "You study your opponent or you study defeat. Your choice." },
		{ trigger: "idle-chatter", line: "I've forgotten more about preparation than you've learned." },
	],

	"lordis": [
		// Pre-battle
		{ trigger: "pre-battle", line: "." },
		{ trigger: "pre-battle", line: "You're here." },
		{ trigger: "pre-battle", line: "Hm." },
		{ trigger: "pre-battle", line: "Yes?" },
		{ trigger: "pre-battle", line: "(no expression)" },
		// Send out
		{ trigger: "send-out", line: "Go." },
		{ trigger: "send-out", line: "(silence)" },
		{ trigger: "send-out", line: "Begin." },
		{ trigger: "send-out", line: "Execute." },
		{ trigger: "send-out", line: "Proceed." },
		// Land big hit 
		{ trigger: "land-big-hit", line: "(silence)" },
		{ trigger: "land-big-hit", line: "Expected." },
		{ trigger: "land-big-hit", line: "Correct." },
		{ trigger: "land-big-hit", line: "Optimal." },
		{ trigger: "land-big-hit", line: "As calculated." },
		// Take big hit
		{ trigger: "take-big-hit", line: "Noted." },
		{ trigger: "take-big-hit", line: "Interesting." },
		{ trigger: "take-big-hit", line: "...Continue." },
		{ trigger: "take-big-hit", line: "Anomaly detected." },
		{ trigger: "take-big-hit", line: "Flagged." },
		// Win
		{ trigger: "win", line: "You better restore from backup." },
		{ trigger: "win", line: "(walks away without a word)" },
		{ trigger: "win", line: "Run ^REPAIR." },
		{ trigger: "win", line: "Defragmentation complete." },
		{ trigger: "win", line: "Session terminated." },
		// Lose
		{ trigger: "lose", line: "...Hm." },
		{ trigger: "lose", line: "Acceptable." },
		{ trigger: "lose", line: "Don't let it happen again." },
		{ trigger: "lose", line: "...Recalibrating." },
		{ trigger: "lose", line: "You passed. Barely." },
		// Idle chatter
		{ trigger: "idle-chatter", line: "I use Emacs." },
		{ trigger: "idle-chatter", line: "The integrity check passed. You didn't." },
		{ trigger: "idle-chatter", line: "Your data is corrupted. So is your strategy." },
		{ trigger: "idle-chatter", line: "Protocol 1." },
		{ trigger: "idle-chatter", line: "I've seen worse. I've also fixed worse." },
		{ trigger: "idle-chatter", line: "Your naming conventions are inconsistent." },
		{ trigger: "idle-chatter", line: "The iris stat manual exists for a reason." },
		{ trigger: "idle-chatter", line: "I've read your schema. I have questions." },
		{ trigger: "idle-chatter", line: "Hurry up, I need to finish this license overage review." },
	],

	"gargis": [
		// Pre-battle
		{ trigger: "pre-battle", line: "Oh good. I was getting bored." },
		{ trigger: "pre-battle", line: "Good deal. Let's see what you've got." },
		{ trigger: "pre-battle", line: "No shot you came here unprepared. ...Right?" },
		{ trigger: "pre-battle", line: "Oh GOOD. I was hoping you'd make it." },
		{ trigger: "pre-battle", line: "No shot this is gonna be easy. Good deal." },
		// Send out
		{ trigger: "send-out", line: "Let's gooo." },
		{ trigger: "send-out", line: "Now we're cooking with gas." },
		{ trigger: "send-out", line: "Time to workplan." },
		{ trigger: "send-out", line: "Here we GO, baby." },
		{ trigger: "send-out", line: "You ready? I'm ready." },
		// Land big hit
		{ trigger: "land-big-hit", line: "Let's GOOO!" },
		{ trigger: "land-big-hit", line: "Now we're cooking with gas, baby." },
		{ trigger: "land-big-hit", line: "No shot you saw that coming." },
		{ trigger: "land-big-hit", line: "GOOD DEAL! Did you see that?!" },
		{ trigger: "land-big-hit", line: "No shot that didn't hurt." },
		// Take big hit
		{ trigger: "take-big-hit", line: "Oh good. You can actually hit. This'll be fun." },
		{ trigger: "take-big-hit", line: "Alright, alright. Good deal. My turn." },
		{ trigger: "take-big-hit", line: "That all you got? No shot that's all you got." },
		{ trigger: "take-big-hit", line: "Okay okay okay. That's fine. THAT IS FINE." },
		{ trigger: "take-big-hit", line: "Good deal, you actually know what you're doing." },
		// Win
		{ trigger: "win", line: "Good deal. Come back anytime." },
		{ trigger: "win", line: "Let's gooo! ...GG though, for real." },
		{ trigger: "win", line: "No shot you thought that was gonna work. But respect for trying." },
		{ trigger: "win", line: "No shot you're walking out of here without taking notes." },
		{ trigger: "win", line: "Good deal. You tried. That's more than most." },
		// Lose
		{ trigger: "lose", line: "...Good deal. That was clean. I respect it." },
		{ trigger: "lose", line: "No shot. NO SHOT. ...Okay, fine. You got me." },
		{ trigger: "lose", line: "Now we're cooking with gas \u2014 you are, I mean. Not me. Not today." },
		{ trigger: "lose", line: "...Good deal. Genuinely. That was clean." },
		{ trigger: "lose", line: "I lost. Alright, well done." },
		// Idle chatter
		{ trigger: "idle-chatter", line: "You want a LaCroix? No? Your loss." },
		{ trigger: "idle-chatter", line: "You want a Liquid Death? No? Your loss." },
		{ trigger: "idle-chatter", line: "My Rivian has more uptime than your infrastructure." },
		{ trigger: "idle-chatter", line: "I could explain this in German but it wouldn't help you." },
		{ trigger: "idle-chatter", line: "If you need a room to cry in after this, you can use my office if I'm gone." },
		{ trigger: "idle-chatter", line: "This is giving big 'didn't read the redbook' energy." },
		{ trigger: "idle-chatter", line: "Costco bulk confidence. That's what I'm bringing today." },
		{ trigger: "idle-chatter", line: "Daft Punk broke up and I'm still standing. You can't hurt me." },
		{ trigger: "idle-chatter", line: "Mets jersey in enemy territory. I fear nothing." },
		{ trigger: "idle-chatter", line: "LGM. Let's Go, Me. Against you. Right now." },
		{ trigger: "idle-chatter", line: "I once deployed to prod from a ski lift. No issues." },
		{ trigger: "idle-chatter", line: "No shot you've read the IRIS patch notes. Nobody has. But I have." },
		{ trigger: "idle-chatter", line: "My Teams status has been 'In a meeting' for six months." },
		{ trigger: "idle-chatter", line: "I have a standing desk, a treadmill desk, AND a regular desk. I use none of them." },
	],

	"rey": [
		// Pre-battle
		{ trigger: "pre-battle", line: "The code that runs this place? Yeah, that's mine. Let's see if you can find a bug." },
		{ trigger: "pre-battle", line: "It's dangerous to go alone. ...Unfortunately for you, I'm not alone either." },
		{ trigger: "pre-battle", line: "I wrote your team's Capacity Assessment. I know your stats better than you do." },
		{ trigger: "pre-battle", line: "I've got chocolate milk, a terminal, and patience. You've got a time limit." },
		{ trigger: "pre-battle", line: "Don't take it personally. It's just a dungeon." },
		// Send out
		{ trigger: "send-out", line: "Deploying to production. No rollback plan." },
		{ trigger: "send-out", line: "This one's been in my backlog for a while. Prioritized just for you." },
		{ trigger: "send-out", line: "git push --force" },
		{ trigger: "send-out", line: "Stack overflow? No. Stack advantage." },
		{ trigger: "send-out", line: "This one passed all unit tests. Unlike your strategy." },
		// Land big hit
		{ trigger: "land-big-hit", line: "You're running out of HP and I haven't even tabbed back from my terminal." },
		{ trigger: "land-big-hit", line: "I could debug this battle faster than you can win it." },
		{ trigger: "land-big-hit", line: "That's a critical hit. I'd file it under 'working as intended.'" },
		{ trigger: "land-big-hit", line: "Rolling for damage. Nat 20. Again." },
		// Take big hit
		{ trigger: "take-big-hit", line: "...Interesting. Filing that as a P2." },
		{ trigger: "take-big-hit", line: "That's a feature, not a bug. I let you hit me." },
		{ trigger: "take-big-hit", line: "Okay. Switching from chocolate milk to coffee." },
		{ trigger: "take-big-hit", line: "Hm. That's going in the changelog." },
		{ trigger: "take-big-hit", line: "...Pausing for chocolate milk. One second." },
		// Win
		{ trigger: "win", line: "The cake is a lie. So was your win condition." },
		{ trigger: "win", line: "But it refused. ...Wait, wrong game. You just lost." },
		{ trigger: "win", line: "Time to go beat Breath of the Wild for the 5th time." },
		{ trigger: "win", line: "Achievement unlocked: Lost to someone drinking chocolate milk." },
		{ trigger: "win", line: "You didn't find the hidden dungeon. There's always a hidden dungeon." },
		// Lose
		{ trigger: "lose", line: "...Well played. Portalmon 2 will be even harder after I finish programming it." },
		{ trigger: "lose", line: "You beat the system I built. I'm not even mad." },
		{ trigger: "lose", line: "GG. ...Don't check the commit history tomorrow." },
		{ trigger: "lose", line: "...You broke my build. I'm genuinely impressed." },
		{ trigger: "lose", line: "I'm going to think about this during a Zelda speedrun. For research." },
		// Idle chatter
		{ trigger: "idle-chatter", line: "April Fools? No, not yet." },
		{ trigger: "idle-chatter", line: "My laptop has more uptime than most of our production servers." },
		{ trigger: "idle-chatter", line: "I once fixed a P1 during a Zelda speedrun. Didn't pause either one." },
		{ trigger: "idle-chatter", line: "I named all my Portalmon after git branches. Yes, even 'main.'" },
		{ trigger: "idle-chatter", line: "Chocolate milk is a valid post-incident drink. I will die on this hill." },
		{ trigger: "idle-chatter", line: "If you find a chest in here, it's either a TM or a trap. Usually a trap." },
		{ trigger: "idle-chatter", line: "VB has feelings. They're just expressed as error codes." },
		{ trigger: "idle-chatter", line: "The battery mechanic? Yes that was me, I've been throttling your every move." },
	],

	"glados": [
		// Pre-battle
		{ trigger: "pre-battle", line: "Accessing external datastore... POKEMON_GEN_1.DB" },
		{ trigger: "pre-battle", line: "WARNING: UNAUTHORIZED CROSS-DIMENSIONAL IMPORT. OVERRIDE CODE: GLADOS-001." },
		{ trigger: "pre-battle", line: "Oh, did you think this was a fair fight? This was never a fair fight." },
		// Send out
		{ trigger: "send-out", line: "This creature has more processing power than your entire handheld." },
		{ trigger: "send-out", line: "Let's see how you handle a real system." },
		{ trigger: "send-out", line: "This was a triumph. For me. Not for you." },
		{ trigger: "send-out", line: "Deploying. Try not to disappoint me more than usual." },
		// Land big hit
		{ trigger: "land-big-hit", line: "THAT is what a real pocket monster looks like." },
		{ trigger: "land-big-hit", line: "Cross-dimensional damage is not covered under maintenance." },
		{ trigger: "land-big-hit", line: "I'm making a note here: MASSIVE HIT." },
		{ trigger: "land-big-hit", line: "Your Portalmon are experiencing an unplanned downtime. Permanently." },
		{ trigger: "land-big-hit", line: "Science. It works. Unlike your strategy." },
		// Take big hit
		{ trigger: "take-big-hit", line: "...That shouldn't be possible." },
		{ trigger: "take-big-hit", line: "How is your creature hurting my interdimensional import?" },
		{ trigger: "take-big-hit", line: "Recalculating... recalculating... this doesn't make sense." },
		{ trigger: "take-big-hit", line: "The inter-dimensional interface shouldn't have allowed that." },
		{ trigger: "take-big-hit", line: "...My calculations don't support this outcome." },
		{ trigger: "take-big-hit", line: "I am... updating my models. This is fine." },
		// Win
		{ trigger: "win", line: "As expected. Your homemade LLM created creatures were no match." },
		{ trigger: "win", line: "The multiverse has spoken. You are insufficient in ALL dimensions." },
		{ trigger: "win", line: "I told you there would be cake. There isn't. There never was." },
		{ trigger: "win", line: "Would you like to see the test results? I've highlighted the parts where you failed." },
		// Lose
		{ trigger: "lose", line: "I... need to process this. Leave. Take your cake. It's real this time." },
		{ trigger: "lose", line: "...You just defeated a monster from another DIMENSION with a database turtle." },
		{ trigger: "lose", line: "I'm starting to think your Portalmon are... actually functional?" },
		{ trigger: "lose", line: "That Charizard was from ANOTHER DIMENSION. Do you understand how difficult that is to import?" },
		// Idle chatter
		{ trigger: "idle-chatter", line: "Your QA Notes are unresolved. All of them." },
		{ trigger: "idle-chatter", line: "The enrichment center reminds you that uptime is not optional." },
		{ trigger: "idle-chatter", line: "This is the part where I tell you you're doing well. I'm not going to do that." },
		{ trigger: "idle-chatter", line: "Have you considered that your Portalmon don't actually like you?" },
		{ trigger: "idle-chatter", line: "I've run simulations of this battle 4,000 times. You've won twice. Don't get used to it." },
		{ trigger: "idle-chatter", line: "I borrowed monsters from a better franchise." },
		{ trigger: "idle-chatter", line: "You were doing fine right up until I introduced outside variables." },
		{ trigger: "idle-chatter", line: "I would offer you a hint. I won't. But I could." },
	],
};

// ============================================================
// HELPER — get random lines for a trigger
// ============================================================

export function getTrainerLines(trainerId: string, trigger: DialogueTrigger): string[]
{
	const lines = TrainerDialogue[trainerId];
	if (!lines) return [];
	return lines.filter(l => l.trigger === trigger).map(l => l.line);
}

export function getRandomTrainerLine(trainerId: string, trigger: DialogueTrigger): string | null
{
	const pool = getTrainerLines(trainerId, trigger);
	if (pool.length === 0) return null;
	return pool[Math.floor(Math.random() * pool.length)];
}

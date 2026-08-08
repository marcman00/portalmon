# Portalmon Content Replacement Quick Reference

> Map filenames in this guide live under Areas/Portalmon/Maps/Source/.

This guide covers replacing the Portalmon roster, gym leaders, trainer parties,
art, and dialogue without changing the battle or overworld systems.

## Safest rule: IDs are wiring; names are content

Every creature and trainer has a machine-facing `id` and a player-facing
`name`. Changing only `name`, stats, art, parties, and dialogue is the safest
option. Changing an ID is allowed, but every reference listed below must change
with it.

Use lowercase ID strings without spaces, for example `packet_pup` or
`leader_ada`. Do not reuse an ID for two entries. The object key and its `id`
field should match.

Two trainer IDs currently have special meaning in code:

- `glados` is the champion and controls game completion/credits.
- `rey` is the postgame developer battle and requires GLaDOS to be defeated.

You can freely change their displayed names, art, parties, and dialogue while
keeping those IDs. Renaming either ID requires deliberate code changes in
`_GymBattleManager.ts` and `PortalmonController.ts`; keeping the IDs is strongly
recommended.

## Replace or add a Portalmon

The roster lives in:

- `Areas/Portalmon/Scripts/data/CreatureList.ts`

Each `CreatureDex` entry requires:

```ts
"packet_pup": {
	id: "packet_pup",
	name: "Packet Pup",
	type: "Performance",
	base: { hp: 75, atk: 18, def: 12, spd: 16 },
	moveIds: ["move_one", "move_two", "move_three"],
	portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/PacketPup.png",
	behindImage: "/Areas/Portalmon/Content/Images/Portalmon/PacketPup_Behind.png",
	ultimateId: "packet_storm",
	chargeArchetype: "Brawler",
	creatureDescription: "A short description shown in the Dex.",
},
```

Important fields:

- `type`: one of `Availability`, `Performance`, `Security`, or `Manageable`.
  Dual types use `"Type/Type"`.
- `base`: HP, attack, defense, and speed. Existing entries are the best balance
  reference; evolutions are generally about 15–20% stronger in key stats.
- `moveIds`: exactly three IDs from `MoveList.ts`.
- `portraitImage`: front/enemy/Dex artwork.
- `behindImage`: player-side battle artwork. It is optional, but should normally
  be supplied.
- `battleSpriteScale`: optional visual scale adjustment.
- `flipEnemy` / `flipPlayer`: optional orientation fixes.
- `ultimateId`: must exist in `UltimateList.ts`.
- `chargeArchetype`: `Brawler`, `Endurance`, `Tactician`, `Momentum`, or
  `Chaos`.
- `evolvesFrom`: put this on the evolved form and point it to the base form ID.
- `portalUnlock: "after_champion_defeated"`: makes a base species postgame-only.

When deleting or renaming a creature ID, update all of these:

1. Trainer `party` arrays in `TrainerList.ts`.
2. `evolvesFrom` references in `CreatureList.ts`.
3. The three `starter:<speciesId>` properties in `Lab.tmx`, if it is a starter.
4. Any tests, comments, or scripted references found with:

```powershell
rg -n 'old_creature_id' . --glob '!node_modules/**' --glob '!dist-static/**'
```

### Starter mapping

The starter portals are authored in `Lab.tmx`. Their current scripts are:

```text
Blue Portal   -> starter:cpfnib
Orange Portal -> starter:normling
Purple Portal -> starter:ressie
```

Change the `scriptId` value on each portal object to the new species ID. The
controller resolves `starter:<id>` directly through `CreatureDex`; no separate
starter list exists.

After editing `Lab.tmx`, regenerate `Lab.generated.ts`:

```powershell
npm.cmd run map:lab
```

## Moves, ultimates, types, and audio

- Regular moves: `Areas/Portalmon/Scripts/data/MoveList.ts`
- Ultimates: `Areas/Portalmon/Scripts/data/UltimateList.ts`
- Types/status effects: `Areas/Portalmon/Scripts/data/TypeList.ts`
- Audio playback: `Areas/Portalmon/Scripts/SoundManager.ts`

Every creature must resolve all three `moveIds`; an unknown move causes a
runtime error when that creature is built for battle. A move needs a unique key
matching its `moveId`.

Prefer reusing the existing four types and status effects. Adding a new type or
status is an engine change: the type chart, descriptions, combat behavior, and
possibly animations all need updates.

Ultimates have more behavioral variants than normal moves. Reusing an existing
ultimate shape with new text/art is safer than inventing a new `special.kind`.
If an ultimate has a `soundFile`, that file must exist in the configured move
audio directory. Normal move audio is selected by `getMoveSoundFile()` in
`MoveList.ts`; missing audio should not break combat, but it will create browser
warnings and play silently.

## Replace a gym leader

Trainer content lives in:

- `Areas/Portalmon/Scripts/data/TrainerList.ts`

For a cosmetic/content replacement, keep the current trainer ID and edit:

- `name`
- `party` (an array of valid creature IDs)
- `portraitImage` and `battleImage`
- `badgeImage`
- `philosophy` and `specialty`
- `mapIntro`, `victoryMessage`, and `winQuote`
- the matching section in `TrainerDialogue`

Gym leaders are discovered automatically from `role: "gym"`. Their order in
`TrainerDefs` determines their slot in some gym-list UI, while their physical
map placement is controlled by Tiled `trainerId` properties.

Current physical mapping:

| Map | Current `trainerId` |
| --- | --- |
| `Gym1.tmx` | `lordis` |
| `Gym2.tmx` | `gargis` |
| `Gym3.tmx` | `coach` |
| `Overworld.tmx` | `rey` |

If you change a gym leader's ID, update the matching Tiled Actable object's
`trainerId`, then regenerate the map. If you only change the trainer's displayed
name, no Tiled edit is needed.

For normal gym maps:

```powershell
npm.cmd run map:gym
```

That command regenerates the gym map data. Do not hand-edit generated files such
as `Gym1.generated.ts`; the next export will overwrite them.

## Trainer dialogue reference

There are two dialogue layers in `TrainerList.ts`:

### Map and result text (`TrainerDefs`)

- `mapIntro`: first line when speaking to the trainer in the overworld.
- `victoryMessage`: shown when the player defeats the trainer and on later talks.
- `winQuote`: shown when the trainer defeats the player.
- `philosophy`: descriptive UI text.

### During-battle text (`TrainerDialogue`)

Each trainer ID can have multiple randomized lines for these triggers:

- `pre-battle`
- `send-out`
- `land-big-hit`
- `take-big-hit`
- `win`
- `lose`
- `idle-chatter`
- `pokemon-defeated` and `portal-opens` (currently GLaDOS-specific)

The key in `TrainerDialogue` must match the trainer ID in `TrainerDefs`.

Not every quote is in `TrainerList.ts`. Also search:

- `PortalmonController.ts` for the lab introduction and GLaDOS conversations.
- `OverworldManager.ts` for the pre-GLaDOS Rey lock response.
- `Gym1.tmx`, `Gym2.tmx`, `Gym3.tmx`, `Lab.tmx`, and `Overworld.tmx` for NPC
  `message` properties.
- Views under `Areas/Portalmon/Views/Home` for headings and fixed UI copy.

A useful full-text audit is:

```powershell
rg -n 'Old Name|distinctive old quote' Areas *.tmx
```

## Trainer and badge art

Current locations:

```text
Areas/Portalmon/Content/Images/Trainers/<Name>_portrait.png
Areas/Portalmon/Content/Images/Trainers/<Name>_battle.png
Areas/Portalmon/Content/Images/Badges/<Name>.png
```

The filenames are not derived from trainer names; `TrainerList.ts` contains the
actual paths. You may use any filename as long as the path matches exactly.
Keeping transparent backgrounds and dimensions comparable to the existing art
will minimize layout adjustments.

Portalmon image paths are likewise explicit. Replacing a file in place is the
lowest-effort option; using new filenames requires updating `CreatureList.ts`.

## Saves while replacing IDs

Creature IDs and trainer IDs are stored in browser saves. During a total roster
replacement, old saves can contain party members, caught creatures, evolutions,
or gym defeats that no longer resolve.

Because backward compatibility is not required, increment both save versions
when the replacement lands:

- `PortalmonCache._version` in `PortalmonController.ts`
- `GymBattleState._version` in `_GymBattleManager.ts`

This forces a clean game rather than attempting to load stale IDs.

## Recommended replacement order

1. Decide all stable creature and trainer IDs first.
2. Add or replace moves and ultimates.
3. Replace `CreatureDex`, including evolution links and art paths.
4. Update the three starter portal scripts in `Lab.tmx`.
5. Replace trainer definitions, parties, and `TrainerDialogue`.
6. Update Tiled `trainerId` properties only when trainer IDs changed.
7. Replace trainer, badge, and Portalmon art.
8. Audit old IDs and old names with `rg`.
9. Increment both save versions.
10. Regenerate maps and run QA.

## Final verification commands

```powershell
npm.cmd run map:lab
npm.cmd run map:gym
npm.cmd run map:tiled
npm.cmd run map:test
npm.cmd run build
```

Then test a fresh game in the browser:

1. Inspect all three starter portals, say NO, then choose each starter in
   separate fresh runs.
2. Open the Dex and verify every portrait, type, move, and evolution.
3. Trigger several wild encounters and catch a creature.
4. Challenge every gym leader and verify front/back sprites, party order,
   quotes, victory text, and badges.
5. Defeat GLaDOS, roll credits, resume, and verify the postgame state.
6. Challenge Rey both before and after GLaDOS to verify the lock.
7. Check the browser console for unknown IDs, missing images, and missing audio.

## Fastest low-risk strategy

If the goal is entirely new presentation and balance without engine work:

- Keep the existing creature IDs but replace their names, data, and images.
- Keep gym trainer IDs `lordis`, `gargis`, and `coach`, but replace everything
  the player sees.
- Keep special IDs `glados` and `rey`.
- Reuse the existing type/status system and ultimate behavior shapes.

The player will see an entirely new roster and cast, while the map, save,
progression, and battle wiring remain stable.

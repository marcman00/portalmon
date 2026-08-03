# Hand-picked NPC crops

Save one PNG per NPC in this folder. Rough crops are fine: the packer trims
transparent space and the sheet's mint-green background automatically.

Use leading numbers to control the final tile order, for example:

```text
001_shopkeeper.png
002_fisher.png
003_ranger.png
```

Run from the project root:

```powershell
python tools/pack_npcs.py
```

The default output uses 16x16 tiles, matching the terrain grid. If a selected
NPC genuinely needs more room, use a larger canvas instead of cutting it:

```powershell
python tools/pack_npcs.py --tile-width 32 --tile-height 32
```

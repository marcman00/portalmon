# Portalmon map sources

This folder owns the editable Tiled map sources for Portalmon.

- Source/*.tmx contains the active overworld, gym, and lab maps.
- Source/*.tsx points to runtime tilesets under Content/Images/Overworld/Tilesets.
- Source/Legacy contains unused experiments retained for reference.
- Generated browser data remains in Scripts/overworld/*.generated.ts.

From the repository root, run npm run map:tiled after changing Overworld.tmx, and npm run map:gym after changing a gym or lab map.
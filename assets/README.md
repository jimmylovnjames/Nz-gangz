# Photo assets

Scanned PBR textures (1K: diffuse, OpenGL normal, AO/roughness/metal) and HDRI skies from
[Poly Haven](https://polyhaven.com), released under **CC0** (public domain). Re-encoded JPEG quality ~80.

The game loads these over the network from jsDelivr (`cdn.jsdelivr.net/gh/jimmylovnjames/Nz-gangz@<branch>/assets/...`)
when opened from a file, or from this folder when served over http(s). If they cannot load, the game keeps its
GPU-generated textures and sky.

| Used for | Asset |
|---|---|
| Town roads | asphalt_02 |
| Suburban chip-seal | tarred_gravel |
| Footpaths | concrete_pavement |
| Kerbs, channels, driveways | concrete_floor_02 |
| Town square | herringbone_brick |
| Brick buildings | brick_wall_02 |
| Plaster buildings | beige_wall_002 |
| Weatherboard houses | white_planks_clean (see Run 16 additions) |
| Painted corrugated iron | corrugated_iron |
| Old galvanised iron | worn_corrugated_iron |
| Lawns and berms | leafy_grass |
| Flat roofs, yards | gravel_floor |
| Roller doors | painted_metal_shutter |
| Paling fences | weathered_brown_planks |
| Tree bark | bark_willow |
| Golden-hour sky | kloppenheim_06_puresky (2K HDR) |
| Overcast sky | kloofendal_overcast_puresky (1K HDR) |


## Run 16 additions

| Used for | Asset |
|---|---|
| Weatherboard houses | white_planks_clean (replaces distressed_painted_planks) |
| Concrete tile roofs | grey_roof_tiles |
| Block walls and fences | concrete_block_wall |

## People (`people/`)

Built by `tools/people-build.py` from the [MakeHuman](http://www.makehumancommunity.org) base mesh, macro targets, default skeleton weights and the MakeHuman system asset pack (skins, clothes, shoes, hair, eyebrows, eyes), all released as **CC0**. Each character is one mesh (`.bin`: positions, normals, UVs, 4 bone weights on the game's 18-bone rig) plus a texture atlas (`.jpg` colour, `_n.jpg` normal, `_a.png` alpha).

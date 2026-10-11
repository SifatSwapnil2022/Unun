# Media

Local copies of the photographs and the three hero clips live here. The folder may be
empty: by default the site loads every picture from its source's own address, listed in
`media/manifest.json`.

| Folder    | Files                              | Used for                                           |
| --------- | ---------------------------------- | -------------------------------------------------- |
| `photos/` | One `.jpg` per key in the manifest | Kitchen covers and profiles, dishes, cuisine tiles |
| `video/`  | `cook.mp4`, `ride.mp4`, `door.mp4` | The three scenes of the home page film             |

A file in this folder always wins over the remote address. Three commands, run from the
repository root, keep the site's list (`apps/web/src/media/library.json`) in step:

- `pnpm media:fetch` downloads everything in the manifest into this folder.
- `pnpm media:library` rebuilds the list after you add or remove a file by hand.
- `pnpm media:check` requests every remote address and lists the ones that fail.

Restart `pnpm dev` after any of them.

## Using your own film

The stock clips are a starting point. Footage shot in Dhaka will always look better
than stock, and the third scene should show the customer paying the rider in taka,
which no free stock clip does.

1. Record three clips of 6 to 10 seconds each, held steady, in landscape.
2. Remove the sound and shrink them. With ffmpeg:

   ```bash
   ffmpeg -i source.mov -an -vf "scale=1280:-2,fps=24" -c:v libx264 -crf 27 -movflags +faststart cook.mp4
   ```

3. Put them in `video/` as `cook.mp4`, `ride.mp4` and `door.mp4`. You can replace one
   scene and leave the others.
4. In `media/manifest.json`, set the clip's `source` to `own` and `credit` to your
   name, and delete its `url` and `page`.
5. Run `pnpm media:library`.

A dark frame with the action on the right-hand side reads best, because the headline
sits bottom-left.

## Using your own photographs

Save the file as `photos/<key>.jpg`, where the key is the one in the manifest, at
1400 pixels wide or more. Set the entry's `source` to `own` and `credit` to your name,
delete its `image` and `page`, and run `pnpm media:library`.

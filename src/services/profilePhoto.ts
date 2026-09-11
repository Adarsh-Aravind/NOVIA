import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Pick a photo and turn it into something small enough to live in a database
 * column.
 *
 * The bytes end up in `profiles.avatar_url` as a `data:` URI rather than in a
 * storage bucket. For two people and a 256px square that is the smaller system
 * by a wide margin — the column already exists, is already couple-scoped by
 * RLS, and is already pushed to the device by the profile realtime channel, so
 * there is no bucket to create, no `storage.objects` policy to write, no
 * ArrayBuffer upload path (React Native has no working Blob route), and no
 * signed URLs to refresh. `<Image>` accepts a `data:` URI directly.
 *
 * The whole design rests on the image actually being small, which is what the
 * resize below guarantees and what the cap at the end of the file enforces.
 */

/** Stored square, in points. 256 is retina-sharp at every size we draw it. */
const TARGET_PX = 256;

/** Visible artefacts start below about 0.5; above 0.7 the file grows fast. */
const QUALITY = 0.6;

/**
 * Refuse anything wider than this.
 *
 * At 256px/0.6 the result lands near 20KB, so this is unreachable in practice.
 * It exists because the failure it guards against is silent: a multi-megabyte
 * row would not announce itself, it would just make every profile fetch and
 * every realtime payload slower, forever.
 */
const MAX_BASE64 = 300_000;

export interface PhotoResult {
  dataUri?: string;
  cancelled?: boolean;
  error?: string;
}

export async function pickProfilePhoto(): Promise<PhotoResult> {
  let picked: ImagePicker.ImagePickerResult;
  try {
    picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // The square crop happens here, in the system UI, so the app never has to
      // reason about aspect ratio or offer a cropper of its own.
      allowsEditing: true,
      aspect: [1, 1],
      // Generous: this is the *intermediate*, and the real compression is the
      // save below. Throwing away detail twice would show.
      quality: 0.9,
    });
  } catch (e: any) {
    return { error: e?.message ?? 'The photo picker could not be opened.' };
  }

  if (picked.canceled || !picked.assets?.length) return { cancelled: true };

  const asset = picked.assets[0];

  try {
    const context = ImageManipulator.manipulate(asset.uri);

    /*
     * Crop to a centred square ourselves rather than trusting `aspect`.
     *
     * `allowsEditing` hands off to whatever editor the OEM ships, and Samsung's
     * honours the crop gesture but not the 1:1 hint — it returned a 1080x890
     * rectangle on the S23. Resizing that straight to 256x256 does not crop it,
     * it *squashes* it, and the avatar came back visibly compressed.
     *
     * Doing the square here makes the result identical on every device and
     * makes `aspect` a nicety rather than a load-bearing promise.
     */
    if (asset.width && asset.height) {
      const side = Math.min(asset.width, asset.height);
      context.crop({
        originX: Math.round((asset.width - side) / 2),
        originY: Math.round((asset.height - side) / 2),
        width: side,
        height: side,
      });
    }

    context.resize({ width: TARGET_PX, height: TARGET_PX });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: QUALITY,
      base64: true,
    });

    if (!saved.base64) return { error: 'The image could not be encoded.' };
    if (saved.base64.length > MAX_BASE64) {
      return { error: 'That image is too large even after resizing. Try another one.' };
    }

    if (__DEV__) {
      console.log('[avatar] stored', Math.round(saved.base64.length / 1024), 'KB');
    }

    return { dataUri: `data:image/jpeg;base64,${saved.base64}` };
  } catch (e: any) {
    return { error: e?.message ?? 'The image could not be processed.' };
  }
}

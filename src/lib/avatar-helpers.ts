// Map avatarKey to captain filename
const AVATAR_MAP: Record<string, string> = {
  '01': 'baggio_fwd_c',
  '02': 'beckham_mid_c',
  '03': 'brolin_mid_c',
  '04': 'giroud_fwd_c',
  '05': 'ronaldinho_mid_c',
  '06': 'ronaldo_fwd_c',
  '07': 'totti_mid_c',
  '08': 'zidane_mid_c',
}

/**
 * Get avatar image path
 * @param avatarKey - Avatar key (01-08)
 * @param color - true for color version, false for grayscale
 * @returns Path to avatar image
 */
export function getAvatarPath(avatarKey: string, color: boolean = true): string {
  const filename = AVATAR_MAP[avatarKey]
  if (!filename) {
    return `/avatars/01.webp` // fallback
  }
  
  if (color) {
    return `/avatars/${filename}.webp`
  } else {
    // Gray version: "baggio_fwd_c" -> "baggio-gray"
    const baseName = filename.split('_')[0]
    return `/avatars/${baseName}-gray.webp`
  }
}

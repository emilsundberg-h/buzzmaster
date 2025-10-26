const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Create avatar conversion script
const convertAvatars = async () => {
  const inputDir = path.join(__dirname, "public", "avatars", "profileimages");
  const outputDir = path.join(__dirname, "public", "avatars");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(inputDir);
  let avatarIndex = 1;

  for (const file of files) {
    if (file.match(/\.(jpg|jpeg|png)$/i)) {
      const inputPath = path.join(inputDir, file);
      const avatarKey = avatarIndex.toString().padStart(2, "0");

      try {
        // Create color version (WebP)
        await sharp(inputPath)
          .resize(200, 200, { fit: "cover" })
          .webp({ quality: 90 })
          .toFile(path.join(outputDir, `${avatarKey}.webp`));

        // Create grayscale version (WebP)
        await sharp(inputPath)
          .resize(200, 200, { fit: "cover" })
          .grayscale()
          .webp({ quality: 90 })
          .toFile(path.join(outputDir, `${avatarKey}-gray.webp`));

        console.log(`Converted avatar ${avatarIndex}: ${file}`);
        avatarIndex++;
      } catch (error) {
        console.error(`Failed to convert ${file}:`, error);
      }
    }
  }

  console.log(
    `Created ${avatarIndex - 1} avatars with color and grayscale versions`
  );
};

convertAvatars().catch(console.error);




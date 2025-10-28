const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Convert SVG avatars to PNG
const convertAvatars = async () => {
  for (let i = 1; i <= 20; i++) {
    const svgPath = path.join(
      __dirname,
      "public",
      "avatars",
      `${i.toString().padStart(2, "0")}.svg`
    );
    const pngPath = path.join(
      __dirname,
      "public",
      "avatars",
      `${i.toString().padStart(2, "0")}.png`
    );

    try {
      await sharp(svgPath).png().resize(100, 100).toFile(pngPath);

      // Remove SVG file
      fs.unlinkSync(svgPath);

      console.log(`Converted avatar ${i}`);
    } catch (error) {
      console.error(`Failed to convert avatar ${i}:`, error);
    }
  }
};

convertAvatars()
  .then(() => {
    console.log("All avatars converted to PNG");
  })
  .catch(console.error);





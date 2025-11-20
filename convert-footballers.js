const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Convert footballer images to webp
const convertFootballers = async () => {
  const folders = ["starting_pack", "footballers"];
  
  for (const folder of folders) {
    const folderPath = path.join(__dirname, "public", folder);
    const files = fs.readdirSync(folderPath);
    
    console.log(`\nConverting ${folder}...`);
    
    for (const file of files) {
      if (file.endsWith(".png")) {
        const pngPath = path.join(folderPath, file);
        const webpPath = path.join(
          folderPath,
          file.replace(".png", ".webp")
        );
        
        try {
          await sharp(pngPath)
            .webp({ quality: 85 })
            .toFile(webpPath);
          
          // Remove PNG file
          fs.unlinkSync(pngPath);
          
          console.log(`✓ Converted ${file}`);
        } catch (error) {
          console.error(`✗ Failed to convert ${file}:`, error.message);
        }
      }
    }
  }
};

convertFootballers()
  .then(() => {
    console.log("\n✓ All footballer images converted to webp");
  })
  .catch(console.error);

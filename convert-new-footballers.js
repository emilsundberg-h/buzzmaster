const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Define players with their positions based on their real-life roles
const playerPositions = {
  'agüero': 'FWD',
  'arnautovic': 'FWD',
  'baggio_fwd': 'FWD',
  'bale': 'FWD',
  'barton': 'MID',
  'batistuta': 'FWD',
  'bendtner': 'FWD',
  'davids': 'MID',
  'del_piero': 'FWD',
  'dzeko': 'FWD',
  'griezmann': 'FWD',
  'guti': 'MID',
  'inzaghi': 'FWD',
  'luiz': 'DEF',
  'makelele': 'MID',
  'nedved': 'MID',
  'raul': 'FWD',
  'ribery': 'FWD',
  'toni': 'FWD'
};

// Clean names for display
const nameMapping = {
  'agüero': 'Sergio Agüero',
  'arnautovic': 'Marko Arnautović',
  'baggio_fwd': 'Roberto Baggio',
  'bale': 'Gareth Bale',
  'barton': 'Joey Barton',
  'batistuta': 'Gabriel Batistuta',
  'bendtner': 'Nicklas Bendtner',
  'davids': 'Edgar Davids',
  'del_piero': 'Alessandro Del Piero',
  'dzeko': 'Edin Džeko',
  'griezmann': 'Antoine Griezmann',
  'guti': 'José María Gutiérrez',
  'inzaghi': 'Filippo Inzaghi',
  'luiz': 'David Luiz',
  'makelele': 'Claude Makélélé',
  'nedved': 'Pavel Nedvěd',
  'raul': 'Raúl González',
  'ribery': 'Franck Ribéry',
  'toni': 'Luca Toni'
};

const sourceDir = path.join(__dirname, 'public', 'new footballers');
const targetDir = path.join(__dirname, 'public', 'footballers');

async function convertImages() {
  console.log('🔄 Converting new footballer images...\n');
  
  if (!fs.existsSync(sourceDir)) {
    console.error('❌ Source directory not found:', sourceDir);
    return;
  }

  const files = fs.readdirSync(sourceDir);
  let converted = 0;
  
  for (const file of files) {
    if (file === '.DS_Store') continue;
    
    const ext = path.extname(file);
    const basename = path.basename(file, ext);
    
    // Skip if already webp
    if (ext.toLowerCase() === '.webp') {
      console.log(`⏭️  ${file} already webp, skipping`);
      continue;
    }
    
    // Check if file already has position suffix (_fwd, _mid, _def, _gk)
    if (!basename.match(/_(fwd|mid|def|gk)$/i)) {
      console.log(`⚠️  Skipping ${file} - no position suffix in filename`);
      continue;
    }
    
    const outputName = `${basename}.webp`;
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, outputName);
    
    // Skip if already exists
    if (fs.existsSync(targetPath)) {
      console.log(`⏭️  ${outputName} already exists, skipping`);
      continue;
    }
    
    try {
      await sharp(sourcePath)
        .resize(800, 800, { 
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 90 })
        .toFile(targetPath);
      
      converted++;
      console.log(`✅ Converted: ${file} → ${outputName}`);
    } catch (error) {
      console.error(`❌ Failed to convert ${file}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Converted ${converted} images!`);
  console.log('\n📋 Next step: Run seed script to add to database');
}

convertImages();

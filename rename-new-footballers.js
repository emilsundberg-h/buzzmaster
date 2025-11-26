const fs = require('fs');
const path = require('path');

// Define positions for each player
const playerPositions = {
  'agüero': 'fwd',
  'arnautovic': 'fwd',
  'baggio_fwd': 'fwd', // Already has _fwd, will handle
  'bale': 'fwd',
  'barton': 'mid',
  'batistuta': 'fwd',
  'bendtner': 'fwd',
  'davids': 'mid',
  'del_piero': 'fwd',
  'dzeko': 'fwd',
  'griezmann': 'fwd',
  'guti': 'mid',
  'inzaghi': 'fwd',
  'luiz': 'def',
  'makelele': 'mid',
  'nedved': 'mid',
  'raul': 'fwd',
  'ribery': 'fwd',
  'toni': 'fwd'
};

const sourceDir = path.join(__dirname, 'public', 'new footballers');

function renameFiles() {
  console.log('📝 Renaming footballer files to include positions...\n');
  
  if (!fs.existsSync(sourceDir)) {
    console.error('❌ Directory not found:', sourceDir);
    return;
  }

  const files = fs.readdirSync(sourceDir);
  let renamed = 0;
  
  for (const file of files) {
    if (file === '.DS_Store') continue;
    
    const ext = path.extname(file);
    const basename = path.basename(file, ext);
    const cleanName = basename.toLowerCase().replace(/\s+/g, '_');
    
    // Check if already has position suffix
    const hasPosition = cleanName.match(/_(fwd|mid|def|gk)$/);
    
    if (hasPosition) {
      console.log(`✓ ${file} already has position`);
      continue;
    }
    
    // Get position for this player
    const position = playerPositions[cleanName];
    
    if (!position) {
      console.log(`⚠️  ${file} - no position defined, skipping`);
      continue;
    }
    
    const newName = `${basename}_${position}${ext}`;
    const oldPath = path.join(sourceDir, file);
    const newPath = path.join(sourceDir, newName);
    
    try {
      fs.renameSync(oldPath, newPath);
      console.log(`✅ ${file} → ${newName}`);
      renamed++;
    } catch (error) {
      console.error(`❌ Failed to rename ${file}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Renamed ${renamed} files!`);
  console.log('\n📋 Next step: Run convert-new-footballers.js to convert to webp');
}

// Show preview first
console.log('📋 Preview of changes:\n');
const files = fs.readdirSync(sourceDir).filter(f => f !== '.DS_Store');
files.forEach(file => {
  const ext = path.extname(file);
  const basename = path.basename(file, ext);
  const cleanName = basename.toLowerCase().replace(/\s+/g, '_');
  const hasPosition = cleanName.match(/_(fwd|mid|def|gk)$/);
  
  if (!hasPosition) {
    const position = playerPositions[cleanName];
    if (position) {
      console.log(`   ${file} → ${basename}_${position}${ext}`);
    }
  }
});

console.log('\n❓ Run rename? (Ctrl+C to cancel, Enter to continue)');
process.stdin.once('data', () => {
  renameFiles();
  process.exit(0);
});
